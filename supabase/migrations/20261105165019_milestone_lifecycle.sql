-- Owner-only internal milestone lifecycle; does not call external calendars.
alter table public.milestones add column cancelled_at timestamptz;
create index milestones_active_owner_id on public.milestones(owner_id,id) where cancelled_at is null;

create function public.update_milestone(p_id uuid,p_milestone uuid,p_patch jsonb) returns public.milestones
language plpgsql security definer set search_path='' as $$
declare uid uuid:=tracker_private.require_owner(); parent public.opportunities;
 old public.milestones; changed public.milestones; action text;
begin
 if p_patch is null or jsonb_typeof(p_patch)<>'object' or octet_length(p_patch::text)>8192 or
 coalesce(jsonb_typeof(p_patch->'expected_revision'),'null')<>'number' or
 coalesce(jsonb_typeof(p_patch->'expected_milestone_revision'),'null')<>'number'
 then raise exception 'Invalid milestone patch' using errcode='22023';end if;
 -- Match the creation lock order: parent first, then the milestone.
 select * into parent from public.opportunities where id=p_id and owner_id=uid for update;
 if not found then raise exception 'Opportunity not found' using errcode='P0002';end if;
 select * into old from public.milestones where id=p_milestone and opportunity_id=p_id and owner_id=uid for update;
 if not found then raise exception 'Milestone not found' using errcode='P0002';end if;
 if (p_patch->>'expected_revision')::integer is distinct from parent.revision or
 (p_patch->>'expected_milestone_revision')::integer is distinct from old.revision
 then raise exception 'Revision conflict' using errcode='40001';end if;
 changed:=old;
 if p_patch?'cancelled' then
  if (p_patch-array['expected_revision','expected_milestone_revision','cancelled'])<>'{}'::jsonb or
  jsonb_typeof(p_patch->'cancelled')<>'boolean'
  then raise exception 'Invalid cancellation patch' using errcode='22023';end if;
  if (old.cancelled_at is not null)=((p_patch->>'cancelled')::boolean) then return old;end if;
  changed.cancelled_at:=case when (p_patch->>'cancelled')::boolean then clock_timestamp() else null end;
  action:=case when changed.cancelled_at is not null then 'milestone_cancelled' else 'milestone_restored' end;
 else
  if old.cancelled_at is not null then raise exception 'Restore milestone before editing' using errcode='22023';end if;
  if (p_patch-array['expected_revision','expected_milestone_revision','title','kind','precision','date','start_at','end_at','timezone','attendance'])<>'{}'::jsonb or
  not (p_patch ?& array['title','kind','precision','timezone','attendance']) or
  exists(select 1 from jsonb_each(p_patch) e where e.key not in ('expected_revision','expected_milestone_revision') and jsonb_typeof(e.value)<>'string') or
  length(trim(p_patch->>'title')) not between 1 and 300 or
  p_patch->>'kind' not in ('deadline','event') or p_patch->>'precision' not in ('date','instant') or
  p_patch->>'attendance' not in ('confirmed','conditional','unknown') or
  not exists(select 1 from pg_timezone_names where name=p_patch->>'timezone')
  then raise exception 'Invalid milestone values' using errcode='22023';end if;
  if p_patch->>'precision'='date' then
   if not (p_patch?'date') or p_patch?'start_at' or p_patch?'end_at' or
   p_patch->>'date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
   then raise exception 'Date-only milestone has no time' using errcode='22023';end if;
  else
   if p_patch?'date' or not (p_patch?'start_at') or
   p_patch->>'start_at' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(:[0-9]{2}(\.[0-9]+)?)?(Z|[+-][0-9]{2}:[0-9]{2})$' or
   (p_patch->>'kind'='deadline' and p_patch?'end_at') or
   (p_patch->>'kind'='event' and (not (p_patch?'end_at') or p_patch->>'end_at' !~ 'T.*(Z|[+-][0-9]{2}:[0-9]{2})$'))
   then raise exception 'Instant requires explicit offset and valid interval' using errcode='22023';end if;
  end if;
  changed.title:=trim(p_patch->>'title');changed.kind:=p_patch->>'kind';changed.precision:=p_patch->>'precision';
  changed.date:=(p_patch->>'date')::date;changed.start_at:=(p_patch->>'start_at')::timestamptz;
  changed.end_at:=(p_patch->>'end_at')::timestamptz;changed.timezone:=p_patch->>'timezone';changed.attendance:=p_patch->>'attendance';
  if changed.kind='event' and changed.precision='instant' and changed.end_at<=changed.start_at
  then raise exception 'Invalid event interval' using errcode='22023';end if;
  if changed is not distinct from old then return old;end if;
  action:='milestone_updated';
 end if;
 update public.milestones set title=changed.title,kind=changed.kind,precision=changed.precision,
 date=changed.date,start_at=changed.start_at,end_at=changed.end_at,timezone=changed.timezone,attendance=changed.attendance,
 cancelled_at=changed.cancelled_at,revision=old.revision+1 where id=old.id and owner_id=uid returning * into changed;
 update public.opportunities set revision=revision+1,updated_at=now() where id=parent.id and owner_id=uid;
 insert into public.change_history(owner_id,opportunity_id,operation,before_value,after_value)
 values(uid,parent.id,action,to_jsonb(old),to_jsonb(changed));
 insert into tracker_private.outbox(owner_id,opportunity_id,event_key,operation)
 values(uid,parent.id,old.id::text||':'||changed.revision::text||':'||action,
 case when action='milestone_cancelled' then 'calendar_cleanup_review' else 'milestone_changed' end);
 return changed;
end $$;
revoke all on function public.update_milestone(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.update_milestone(uuid,uuid,jsonb) to authenticated;


-- Preserve the existing token-guarded read API and omit cancelled deadlines.
create or replace function public.agent_read(p_token text,p_operation text,p_args jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare g tracker_private.agent_grants; n integer; rows jsonb; more boolean; item jsonb;
begin
 if p_operation not in ('search_opportunities','get_opportunity','get_upcoming_deadlines') or p_operation is null
 then raise exception 'Operation denied' using errcode='42501';end if;
 g:=tracker_private.authorize_agent(p_token,case when p_operation='get_upcoming_deadlines' then 'agenda:read' else 'opportunities:read' end);
 if p_args is null or jsonb_typeof(p_args)<>'object' or octet_length(p_args::text)>8192
 then raise exception 'Invalid filters' using errcode='22023';end if;
 if p_operation='get_opportunity' then
  if (p_args-array['opportunity_id','after'])<>'{}'::jsonb then raise exception 'Invalid filters' using errcode='22023';end if;
  select tracker_private.agent_projection(o) into item from public.opportunities o where o.owner_id=g.owner_id and o.id=(p_args->>'opportunity_id')::uuid and o.archived_at is null;
  return jsonb_build_object('item',item);
 end if;
 n:=coalesce((p_args->>'limit')::integer,case when p_operation='get_upcoming_deadlines' then 50 else 20 end);
 if n<1 or n>(case when p_operation='get_upcoming_deadlines' then 50 else 20 end) or
 (p_args?'category' and p_args->>'category' not in ('job','bootcamp','competition'))
 then raise exception 'Invalid filters' using errcode='22023';end if;
 if p_operation='search_opportunities' then
  if (p_args-array['query','category','stage','arrangement','max_employer_hours','include_unknown_hours','limit','after'])<>'{}'::jsonb or
  length(p_args->>'query')>200 or
  (p_args?'stage' and p_args->>'stage' not in ('saved','preparing','applied','interview','accepted','rejected','withdrawn')) or
  (p_args?'arrangement' and p_args->>'arrangement' not in ('remote','hybrid','onsite','unknown')) or
  (p_args?'include_unknown_hours' and jsonb_typeof(p_args->'include_unknown_hours')<>'boolean') or
  (p_args?'max_employer_hours' and ((p_args->>'max_employer_hours')::numeric not between 0 and 168))
  then raise exception 'Invalid filters' using errcode='22023';end if;
  select coalesce(jsonb_agg(tracker_private.agent_projection(o) order by o.id),'[]'::jsonb) into rows from (
   select * from public.opportunities o where o.owner_id=g.owner_id and o.archived_at is null
   and (p_args->>'after' is null or o.id>(p_args->>'after')::uuid)
   and (p_args->>'category' is null or o.category=p_args->>'category')
   and (p_args->>'stage' is null or o.personal_stage=p_args->>'stage')
   and (p_args->>'arrangement' is null or coalesce(o.arrangement,'unknown')=p_args->>'arrangement')
   and (p_args->>'query' is null or strpos(lower(coalesce(o.title,'')||' '||coalesce(o.organization,'')),lower(p_args->>'query'))>0)
   and (p_args->>'max_employer_hours' is null or o.employer_hours<=(p_args->>'max_employer_hours')::numeric or
    (o.employer_hours is null and coalesce((p_args->>'include_unknown_hours')::boolean,false)))
   order by o.id limit n+1
  ) o;
 else
  if (p_args-array['start_date','end_date','category','limit','after'])<>'{}'::jsonb or
  p_args->>'start_date' is null or p_args->>'end_date' is null or
  (p_args->>'end_date')::date-(p_args->>'start_date')::date not between 0 and 30
  then raise exception 'Invalid dates' using errcode='22023';end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'opportunity_id',m.opportunity_id,'title',m.title,
   'precision',m.precision,'date',m.date,'start_at',m.start_at,'timezone',m.timezone,'revision',m.revision) order by m.id),'[]'::jsonb) into rows
  from (select m.* from public.milestones m join public.opportunities o on o.id=m.opportunity_id and o.owner_id=m.owner_id
   where m.owner_id=g.owner_id and o.archived_at is null and m.kind='deadline' and m.cancelled_at is null
   and (p_args->>'after' is null or m.id>(p_args->>'after')::uuid)
   and (p_args->>'category' is null or o.category=p_args->>'category')
   and coalesce(m.date,(m.start_at at time zone 'Asia/Jakarta')::date) between (p_args->>'start_date')::date and (p_args->>'end_date')::date
   order by m.id limit n+1) m;
 end if;
 more:=jsonb_array_length(rows)>n;
 if more then rows:=rows-n;end if;
 return jsonb_build_object('items',rows,'after',case when more then rows->(n-1)->>'id' else null end);
end $$;

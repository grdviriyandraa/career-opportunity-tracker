-- WP06: local development migration. No service-role key is needed for agent routes.
alter table public.opportunities add column arrangement text check(arrangement in ('remote','hybrid','onsite','unknown'));
alter table public.opportunities add column remote_eligibility text check(length(remote_eligibility)<=500);

create table tracker_private.agent_grants (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(owner_id),
 token_hash text not null unique check(length(token_hash)=64), prefix text not null,
 label text not null check(length(label) between 1 and 80), scopes text[] not null,
 created_at timestamptz not null default now(), expires_at timestamptz not null,
 revoked_at timestamptz, last_used_at timestamptz,
 read_window timestamptz, read_count integer not null default 0,
 draft_window timestamptz, draft_count integer not null default 0,
 check(cardinality(scopes) between 1 and 3 and scopes <@ array['opportunities:read','agenda:read','drafts:create']::text[])
);
create index agent_grants_owner on tracker_private.agent_grants(owner_id,created_at desc);
create table tracker_private.agent_receipts (
 owner_id uuid not null references public.profiles(owner_id), integration_id uuid not null references tracker_private.agent_grants(id),
 key uuid not null, payload_hash text not null, receipt jsonb not null, created_at timestamptz not null default now(),
 primary key(owner_id,integration_id,key)
);
alter table tracker_private.agent_grants enable row level security;
alter table tracker_private.agent_receipts enable row level security;
revoke all on tracker_private.agent_grants,tracker_private.agent_receipts from public,anon,authenticated;

create function tracker_private.grant_metadata(g tracker_private.agent_grants) returns jsonb
language sql immutable set search_path='' as $$
 select jsonb_build_object('id',g.id,'label',g.label,'prefix',g.prefix,'scopes',g.scopes,
 'created_at',g.created_at,'expires_at',g.expires_at,'revoked_at',g.revoked_at,'last_used_at',g.last_used_at)
$$;
create function public.list_agent_grants() returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=tracker_private.require_owner(); result jsonb;
begin
 select coalesce(jsonb_agg(tracker_private.grant_metadata(g) order by g.created_at desc),'[]'::jsonb) into result
 from (select * from tracker_private.agent_grants where owner_id=uid order by created_at desc limit 100) g;
 return result;
end $$;
create function public.mint_agent_grant(p_token text,p_label text,p_scopes text[],p_days integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=tracker_private.require_owner(); g tracker_private.agent_grants;
begin
 if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' or p_token like 'sb\_%' escape '\' or
 p_label is null or length(trim(p_label)) not between 1 and 80 or p_days is null or p_days not between 1 and 30 or
 p_scopes is null or cardinality(p_scopes) not between 1 and 3 or array_position(p_scopes,null) is not null or
 not (p_scopes <@ array['opportunities:read','agenda:read','drafts:create']::text[]) or
 (select count(distinct s) from unnest(p_scopes) s)<>cardinality(p_scopes)
 then raise exception 'Invalid credential configuration' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 if (select count(*) from tracker_private.agent_grants where owner_id=uid and revoked_at is null and expires_at>now())>=10
 then raise exception 'Active credential limit reached' using errcode='22023';end if;
 insert into tracker_private.agent_grants(owner_id,token_hash,prefix,label,scopes,expires_at)
 values(uid,encode(sha256(convert_to(p_token,'UTF8')),'hex'),left(p_token,8),trim(p_label),p_scopes,now()+make_interval(days=>p_days)) returning * into g;
 return tracker_private.grant_metadata(g);
end $$;
create function public.revoke_agent_grant(p_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare uid uuid:=tracker_private.require_owner();
begin
 update tracker_private.agent_grants set revoked_at=coalesce(revoked_at,now()) where id=p_id and owner_id=uid;
 return found;
end $$;

-- All direct Data API calls enforce the same scope, expiry, revoke and rate checks as HTTP routes.
create function tracker_private.authorize_agent(p_token text,p_scope text) returns tracker_private.agent_grants
language plpgsql security definer set search_path='' as $$
declare g tracker_private.agent_grants; window_start timestamptz:=date_trunc('minute',clock_timestamp());
begin
 if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then raise exception 'Credential rejected' using errcode='28000';end if;
 select * into g from tracker_private.agent_grants where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') for update;
 if not found or g.revoked_at is not null or g.expires_at<=clock_timestamp() or
 not exists(select 1 from public.profiles p join auth.users u on u.id=p.owner_id
  where p.owner_id=g.owner_id and u.deleted_at is null and (u.banned_until is null or u.banned_until<=clock_timestamp()))
 then raise exception 'Credential rejected' using errcode='28000';end if;
 if not (p_scope=any(g.scopes)) then raise exception 'Scope denied' using errcode='42501';end if;
 if p_scope='drafts:create' then
  if g.draft_window=window_start and g.draft_count>=10 then raise exception 'Rate limited' using errcode='PT429';end if;
  update tracker_private.agent_grants set draft_count=case when draft_window=window_start then draft_count+1 else 1 end,
   draft_window=window_start,last_used_at=clock_timestamp() where id=g.id;
 else
  if g.read_window=window_start and g.read_count>=30 then raise exception 'Rate limited' using errcode='PT429';end if;
  update tracker_private.agent_grants set read_count=case when read_window=window_start then read_count+1 else 1 end,
   read_window=window_start,last_used_at=clock_timestamp() where id=g.id;
 end if;
 return g;
end $$;

-- Shared domain write; callers own their channel-specific receipt and authentication.
create function tracker_private.persist_draft(uid uuid,p_payload jsonb,p_canonical text,p_actor text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.opportunities; created boolean:=false;
begin
 if uid is null or p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>65536 or
 (p_payload - array['source_url','source_text','title','category'])<>'{}'::jsonb or
 not (coalesce(length(trim(p_payload->>'title')),0)>0 or coalesce(length(trim(p_payload->>'source_url')),0)>0 or coalesce(length(trim(p_payload->>'source_text')),0)>0) or
 exists(select 1 from jsonb_each(p_payload) e where jsonb_typeof(e.value)<>'string') or
 (p_payload?'title' and length(trim(p_payload->>'title')) not between 1 and 300) or
 (p_payload?'source_text' and length(trim(p_payload->>'source_text')) not between 1 and 20000) or
 (p_payload?'category' and p_payload->>'category' not in ('job','bootcamp','competition')) or
 (p_payload?'source_url' and (p_canonical is null or length(p_payload->>'source_url')>2048 or p_payload->>'source_url' !~* '^https?://[^/@[:space:]]+([/?#]|$)')) or
 (p_canonical is not null and (not (p_payload?'source_url') or length(p_canonical)>2048 or p_canonical !~* '^https?://[^/@[:space:]]+([/?#]|$)'))
 then raise exception 'Invalid capture' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 if p_canonical is not null then select * into o from public.opportunities where owner_id=uid and canonical_url=p_canonical;end if;
 if o.id is null then
  insert into public.opportunities(owner_id,category,title,source_url,source_text,canonical_url)
  values(uid,p_payload->>'category',p_payload->>'title',p_payload->>'source_url',p_payload->>'source_text',p_canonical) returning * into o;
  created:=true;
  insert into public.change_history(owner_id,opportunity_id,actor,operation,after_value) values(uid,o.id,p_actor,'capture',to_jsonb(o));
  insert into tracker_private.outbox(owner_id,opportunity_id,event_key,operation) values(uid,o.id,o.id::text||':1:capture','extraction_manual_required');
 end if;
 return jsonb_build_object('outcome',case when created then 'created' else 'existing' end,'opportunity_id',o.id,'revision',o.revision,'saved_at',o.created_at,'extraction_status','manual_required');
end $$;
create or replace function public.capture_draft(p_payload jsonb,p_key uuid,p_canonical text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=tracker_private.require_owner(); old tracker_private.capture_receipts; result jsonb;
 h text:=encode(sha256(convert_to(p_payload::text,'UTF8')),'hex');
begin
 if p_key is null or p_payload is null or jsonb_typeof(p_payload)<>'object'
 then raise exception 'Key and capture object required' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 select * into old from tracker_private.capture_receipts where owner_id=uid and key=p_key;
 if found then if old.payload_hash<>h then raise exception 'Idempotency conflict' using errcode='40001';end if;return old.receipt;end if;
 result:=tracker_private.persist_draft(uid,p_payload,p_canonical,'website_owner');
 insert into tracker_private.capture_receipts(owner_id,key,payload_hash,receipt) values(uid,p_key,h,result);
 return result;
end $$;
create function public.agent_capture(p_token text,p_payload jsonb,p_key uuid,p_canonical text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare g tracker_private.agent_grants:=tracker_private.authorize_agent(p_token,'drafts:create');
 old tracker_private.agent_receipts; result jsonb; h text:=encode(sha256(convert_to(p_payload::text,'UTF8')),'hex');
begin
 if p_key is null or p_payload is null or jsonb_typeof(p_payload)<>'object'
 then raise exception 'Key and capture object required' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(g.owner_id::text,0));
 select * into old from tracker_private.agent_receipts where owner_id=g.owner_id and integration_id=g.id and key=p_key;
 if found then if old.payload_hash<>h then raise exception 'Idempotency conflict' using errcode='40001';end if;
  return jsonb_build_object('receipt',old.receipt,'replayed',true);end if;
 result:=tracker_private.persist_draft(g.owner_id,p_payload,p_canonical,'hermes_integration');
 insert into tracker_private.agent_receipts(owner_id,integration_id,key,payload_hash,receipt) values(g.owner_id,g.id,p_key,h,result);
 return jsonb_build_object('receipt',result,'replayed',false);
end $$;

create function tracker_private.agent_projection(o public.opportunities) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('id',o.id,'category',o.category,'title',o.title,'organization',o.organization,
 'personal_stage',o.personal_stage,'posting_status',o.posting_status,'eligibility',o.eligibility,
 'employer_hours',o.employer_hours,'arrangement',o.arrangement,'remote_eligibility',o.remote_eligibility,'revision',o.revision,'evidence','[]'::jsonb)
$$;
create function public.agent_read(p_token text,p_operation text,p_args jsonb) returns jsonb
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
   where m.owner_id=g.owner_id and o.archived_at is null and m.kind='deadline'
   and (p_args->>'after' is null or m.id>(p_args->>'after')::uuid)
   and (p_args->>'category' is null or o.category=p_args->>'category')
   and coalesce(m.date,(m.start_at at time zone 'Asia/Jakarta')::date) between (p_args->>'start_date')::date and (p_args->>'end_date')::date
   order by m.id limit n+1) m;
 end if;
 more:=jsonb_array_length(rows)>n;
 if more then rows:=rows-n;end if;
 return jsonb_build_object('items',rows,'after',case when more then rows->(n-1)->>'id' else null end);
end $$;

revoke all on all functions in schema tracker_private from public,anon,authenticated;
revoke all on function public.list_agent_grants(),public.mint_agent_grant(text,text,text[],integer),public.revoke_agent_grant(uuid) from public,anon,authenticated;
grant execute on function public.list_agent_grants(),public.mint_agent_grant(text,text,text[],integer),public.revoke_agent_grant(uuid) to authenticated;
revoke all on function public.agent_capture(text,jsonb,uuid,text),public.agent_read(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.agent_capture(text,jsonb,uuid,text),public.agent_read(text,text,jsonb) to anon;

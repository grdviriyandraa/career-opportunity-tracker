-- Research history: immutable source snapshots, owner review and no personal-field writes.
create table public.research_runs (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(owner_id),
 source_system text not null, run_id text not null, payload_hash text not null, source_as_of text not null,
 source_timezone text not null, imported_at timestamptz not null default now(), inventory_total int not null,
 sources_checked int not null, new_count int not null, enriched_count int not null, carry_forward int not null,
 reported_new int, reported_enriched int, high_priority_active int, snapshot jsonb not null, coverage text, limitations jsonb,
 unique(owner_id,source_system,run_id), unique(owner_id,id),
 check(inventory_total>=0 and sources_checked>=0 and new_count>=0 and enriched_count>=0 and carry_forward>=0),
 check(sources_checked=new_count+enriched_count and inventory_total=sources_checked+carry_forward)
);
create index research_runs_list on public.research_runs(owner_id,imported_at desc,id);
create table public.research_identities (
 owner_id uuid not null,source_system text not null,external_id text not null,opportunity_id uuid not null,
 first_seen_at date,source_checked_at text,public_snapshot jsonb not null,
 primary key(owner_id,source_system,external_id),unique(owner_id,source_system,opportunity_id),
 foreign key(owner_id,opportunity_id) references public.opportunities(owner_id,id)
);
create table public.research_items (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null,research_run_id uuid not null,opportunity_id uuid not null,
 external_id text not null,action text not null check(action in ('new','enriched','carry_forward')),
 checked_at text,last_source_checked_at text,first_seen_at date,public_snapshot jsonb not null,
 foreign key(owner_id,research_run_id) references public.research_runs(owner_id,id),
 foreign key(owner_id,opportunity_id) references public.opportunities(owner_id,id),
 unique(research_run_id,external_id),check((action='carry_forward' and checked_at is null) or (action<>'carry_forward' and checked_at is not null))
);
create index research_items_run on public.research_items(owner_id,research_run_id,external_id);
create table public.research_proposals (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null,research_run_id uuid not null,opportunity_id uuid not null,
 expected_revision int not null,proposed_public_snapshot jsonb not null,base_public_snapshot jsonb not null,receipt jsonb,status text not null default 'pending' check(status in ('pending','accepted','dismissed')),
 unique(research_run_id,opportunity_id),
 foreign key(owner_id,research_run_id) references public.research_runs(owner_id,id),
 foreign key(owner_id,opportunity_id) references public.opportunities(owner_id,id)
);
create table public.research_corrections (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null,research_run_id uuid not null,payload_hash text not null,
 proposed_summary jsonb not null,status text not null default 'review_required',created_at timestamptz not null default now(),
 foreign key(owner_id,research_run_id) references public.research_runs(owner_id,id),unique(owner_id,research_run_id,payload_hash)
);
create table tracker_private.research_previews (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.profiles(owner_id),
 payload jsonb not null,payload_hash text not null,state_hash text not null,summary jsonb not null,
 expires_at timestamptz not null default now()+interval '15 minutes',receipt jsonb
);
create table tracker_private.research_correction_payloads (
 correction_id uuid primary key references public.research_corrections(id),payload jsonb not null
);
do $$ declare t text;begin
 foreach t in array array['research_runs','research_identities','research_items','research_proposals','research_corrections'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy owner_read on public.%I for select to authenticated using(owner_id=auth.uid())',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;
create function tracker_private.research_state(p_owner uuid) returns text language sql volatile set search_path='' as $$
 select encode(sha256(convert_to(jsonb_build_object(
 'opportunities',(select coalesce(jsonb_agg(jsonb_build_array(id,revision) order by id),'[]'::jsonb) from public.opportunities where owner_id=p_owner),
 'runs',(select coalesce(jsonb_agg(jsonb_build_array(id,payload_hash) order by id),'[]'::jsonb) from public.research_runs where owner_id=p_owner))::text,'UTF8')),'hex')
$$;
create function public.prepare_research(p_batch jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=tracker_private.require_owner();h text;old public.research_runs;entry jsonb;existing public.research_identities;
 n int:=0;e int:=0;total int;calculated jsonb;summary jsonb;preview uuid;correction uuid;seen int;latest timestamptz;
begin
 if jsonb_typeof(p_batch) is distinct from 'object' or octet_length(p_batch::text)>524288 or
 (p_batch-array['schema_version','source_system','run_id','source_as_of','source_timezone','inventory_total','reported_new','reported_enriched','high_priority_active','snapshot','coverage','limitations','items'])<>'{}'::jsonb or
 p_batch->>'schema_version' is distinct from '1' or coalesce(p_batch->>'source_system','')!~'^[a-zA-Z0-9_-]{1,100}$' or
 coalesce(length(p_batch->>'run_id'),0) not between 1 and 200 or
 jsonb_typeof(p_batch->'items') is distinct from 'array' or jsonb_array_length(p_batch->'items')>1000 or
 not exists(select 1 from pg_timezone_names where name=p_batch->>'source_timezone') or p_batch->>'source_as_of' is null
 then raise exception 'Invalid research batch' using errcode='22023';end if;
 perform (p_batch->>'source_as_of')::timestamptz;
 if jsonb_typeof(p_batch->'snapshot') is distinct from 'object' or ((p_batch->'snapshot')-array['confirmed','conditional','pending','ineligible','closed'])<>'{}'::jsonb then raise exception 'Invalid snapshot' using errcode='22023';end if;
 foreach entry in array array[p_batch->'snapshot'] loop
  if not (entry ?& array['confirmed','conditional','pending','ineligible','closed']) then raise exception 'Incomplete snapshot' using errcode='22023';end if;
 end loop;
 for entry in select value from jsonb_array_elements(p_batch->'items') loop
  if jsonb_typeof(entry) is distinct from 'object' or
  (entry-array['external_id','action','category','title','organization','classification','source_url','canonical_url','source_checked_at','first_seen_at','published_at','official_deadline','raw_posting_status'])<>'{}'::jsonb or
  coalesce(length(entry->>'external_id'),0) not between 1 and 200 or entry->>'action' is null or entry->>'action' not in ('new','enriched') or
  entry->>'classification' is null or entry->>'classification' not in ('confirmed','conditional','pending','ineligible','closed') or
  coalesce(entry->>'source_url','')!~'^https?://' or coalesce(entry->>'canonical_url','')!~'^https?://' or
  entry->>'source_checked_at' is null or (entry->>'source_checked_at')::timestamptz>(p_batch->>'source_as_of')::timestamptz or
  ((entry->>'first_seen_at')::date > ((p_batch->>'source_as_of')::timestamptz at time zone (p_batch->>'source_timezone'))::date) or
  (entry->>'category' is not null and entry->>'category' not in ('job','bootcamp','competition'))
  then raise exception 'Invalid public research item' using errcode='22023';end if;
 end loop;
 select count(distinct value->>'external_id'),count(*) into seen,total from jsonb_array_elements(p_batch->'items');
 if seen<>total then raise exception 'Duplicate research identity' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 h:=encode(sha256(convert_to(p_batch::text,'UTF8')),'hex');
 select * into old from public.research_runs where owner_id=uid and source_system=p_batch->>'source_system' and run_id=p_batch->>'run_id';
 if found then
  if old.payload_hash=h then return jsonb_build_object('status','replay','research_run_id',old.id,'run_id',old.run_id,'domain_created',0,'public_proposals',0);end if;
  insert into public.research_corrections(owner_id,research_run_id,payload_hash,proposed_summary)
  values(uid,old.id,h,p_batch-array['items']) on conflict(owner_id,research_run_id,payload_hash) do update set payload_hash=excluded.payload_hash returning id into correction;
  insert into tracker_private.research_correction_payloads values(correction,p_batch) on conflict do nothing;
  return jsonb_build_object('status','correction_required','research_run_id',old.id,'correction_id',correction);
 end if;
 select max(source_as_of::timestamptz) into latest from public.research_runs where owner_id=uid and source_system=p_batch->>'source_system';
 if latest is not null and (p_batch->>'source_as_of')::timestamptz<latest then raise exception 'Out of order research run' using errcode='40001';end if;
 for entry in select value from jsonb_array_elements(p_batch->'items') loop
  select * into existing from public.research_identities where owner_id=uid and source_system=p_batch->>'source_system' and external_id=entry->>'external_id';
  if entry->>'action'='enriched' then
   if not found then raise exception 'Unknown existing identity; initial migration required' using errcode='22023';end if;
   if (entry->>'source_checked_at')::timestamptz<existing.source_checked_at::timestamptz then raise exception 'Older evidence' using errcode='40001';end if;
   if (entry->>'first_seen_at')::date is distinct from existing.first_seen_at then raise exception 'First seen requires review' using errcode='40001';end if;
   e:=e+1;
  else
   if found then raise exception 'New identity already exists' using errcode='22023';end if;n:=n+1;
  end if;
 end loop;
 with incoming as (select value->>'external_id' external_id,value->>'classification' classification from jsonb_array_elements(p_batch->'items')),
 projected as (select public_snapshot->>'classification' classification from public.research_identities r where owner_id=uid and source_system=p_batch->>'source_system' and not exists(select 1 from incoming i where i.external_id=r.external_id) union all select classification from incoming)
 select count(*),jsonb_build_object('confirmed',count(*) filter(where classification='confirmed'),'conditional',count(*) filter(where classification='conditional'),'pending',count(*) filter(where classification='pending'),'ineligible',count(*) filter(where classification='ineligible'),'closed',count(*) filter(where classification='closed')) into total,calculated from projected;
 if total is distinct from (p_batch->>'inventory_total')::int or calculated<>p_batch->'snapshot' or
 (p_batch->>'reported_new' is not null and (p_batch->>'reported_new')::int<>n) or
 (p_batch->>'reported_enriched' is not null and (p_batch->>'reported_enriched')::int<>e) or
 (p_batch->>'high_priority_active' is not null and (p_batch->>'high_priority_active')::int not between 0 and total)
 then raise exception 'Research counts do not reconcile' using errcode='22023';end if;
 summary:=jsonb_build_object('inventory_total',total,'sources_checked',n+e,'new_count',n,'enriched_count',e,'carry_forward',total-n-e,'snapshot',calculated);
 insert into tracker_private.research_previews(owner_id,payload,payload_hash,state_hash,summary) values(uid,p_batch,h,tracker_private.research_state(uid),summary) returning id into preview;
 return summary||jsonb_build_object('status','preview','preview_id',preview,'payload_hash',h,'run_id',p_batch->>'run_id');
end $$;
create function public.apply_research(p_preview uuid,p_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=tracker_private.require_owner();preview tracker_private.research_previews;b jsonb;entry jsonb;ident public.research_identities;
 o public.opportunities;run uuid;created int:=0;proposals int:=0;result jsonb;public_fields jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 select * into preview from tracker_private.research_previews where owner_id=uid and id=p_preview for update;
 if not found then raise exception 'Preview not found' using errcode='P0002';end if;
 if preview.payload_hash is distinct from p_hash then raise exception 'Preview hash mismatch' using errcode='40001';end if;
 if preview.receipt is not null then return preview.receipt||jsonb_build_object('status','replay','domain_created',0,'public_proposals',0);end if;
 if preview.expires_at<now() then raise exception 'Preview expired' using errcode='40001';end if;
 perform 1 from public.opportunities where owner_id=uid order by id for update;
 if preview.state_hash is distinct from tracker_private.research_state(uid) then raise exception 'Stale preview; review again' using errcode='40001';end if;
 b:=preview.payload;
 insert into public.research_runs(owner_id,source_system,run_id,payload_hash,source_as_of,source_timezone,inventory_total,sources_checked,new_count,enriched_count,carry_forward,reported_new,reported_enriched,high_priority_active,snapshot,coverage,limitations)
 values(uid,b->>'source_system',b->>'run_id',preview.payload_hash,b->>'source_as_of',b->>'source_timezone',(preview.summary->>'inventory_total')::int,(preview.summary->>'sources_checked')::int,(preview.summary->>'new_count')::int,(preview.summary->>'enriched_count')::int,(preview.summary->>'carry_forward')::int,(b->>'reported_new')::int,(b->>'reported_enriched')::int,(b->>'high_priority_active')::int,b->'snapshot',b->>'coverage',nullif(b->'limitations','null'::jsonb)) returning id into run;
 for entry in select value from jsonb_array_elements(b->'items') loop
  o:=null;
  select * into ident from public.research_identities where owner_id=uid and source_system=b->>'source_system' and external_id=entry->>'external_id';
  if found then select * into o from public.opportunities where id=ident.opportunity_id and owner_id=uid;end if;
  if o.id is null then select * into o from public.opportunities where owner_id=uid and canonical_url=entry->>'canonical_url';end if;
  public_fields:=entry-array['action','canonical_url','external_id'];
  if o.id is null then
   insert into public.opportunities(owner_id,category,title,organization,source_url,canonical_url,eligibility,posting_status)
   values(uid,entry->>'category',entry->>'title',entry->>'organization',entry->>'source_url',entry->>'canonical_url',case entry->>'classification' when 'confirmed' then 'eligible' when 'conditional' then 'conditional' when 'pending' then 'pending' when 'ineligible' then 'ineligible' else 'unknown' end,case when entry->>'classification'='closed' then 'closed' else 'unknown' end) returning * into o;
   insert into public.change_history(owner_id,opportunity_id,actor,operation,after_value) values(uid,o.id,'research_import','research_capture',to_jsonb(o));
   insert into tracker_private.outbox(owner_id,opportunity_id,event_key,operation) values(uid,o.id,run::text||':'||o.id::text,'research_captured_manual_review');
   created:=created+1;
  else
   if (ident.public_snapshot-array['source_checked_at']) is distinct from (public_fields-array['source_checked_at']) then
    insert into public.research_proposals(owner_id,research_run_id,opportunity_id,expected_revision,proposed_public_snapshot,base_public_snapshot) values(uid,run,o.id,o.revision,public_fields,jsonb_build_object('title',o.title,'organization',o.organization,'eligibility',o.eligibility,'posting_status',o.posting_status));proposals:=proposals+1;
   end if;
  end if;
  insert into public.research_identities(owner_id,source_system,external_id,opportunity_id,first_seen_at,source_checked_at,public_snapshot)
  values(uid,b->>'source_system',entry->>'external_id',o.id,(entry->>'first_seen_at')::date,entry->>'source_checked_at',public_fields)
  on conflict(owner_id,source_system,external_id) do update set source_checked_at=excluded.source_checked_at,public_snapshot=excluded.public_snapshot;
 end loop;
 insert into public.research_items(owner_id,research_run_id,opportunity_id,external_id,action,checked_at,last_source_checked_at,first_seen_at,public_snapshot)
 select uid,run,r.opportunity_id,r.external_id,coalesce(i.value->>'action','carry_forward'),i.value->>'source_checked_at',r.source_checked_at,r.first_seen_at,r.public_snapshot
 from public.research_identities r left join jsonb_array_elements(b->'items') i on i.value->>'external_id'=r.external_id
 where r.owner_id=uid and r.source_system=b->>'source_system';
 result:=preview.summary||jsonb_build_object('status','applied','research_run_id',run,'run_id',b->>'run_id','domain_created',created,'public_proposals',proposals);
 update tracker_private.research_previews set receipt=result where id=p_preview;
 return result;
end $$;
revoke all on function public.prepare_research(jsonb),public.apply_research(uuid,text) from public,anon;
grant execute on function public.prepare_research(jsonb),public.apply_research(uuid,text) to authenticated;
create function public.resolve_research_proposal(p_id uuid,p_expected int,p_action text,p_fields text[]) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=tracker_private.require_owner();proposal public.research_proposals;o public.opportunities;changed public.opportunities;fields text[];result jsonb;eligibility_value text;
begin
 if p_action is null or p_action not in ('accept','dismiss') or p_fields is null or cardinality(p_fields)>4 or
 (select count(distinct x) from unnest(p_fields) x)<>cardinality(p_fields) or
 exists(select 1 from unnest(p_fields) x where x not in ('title','organization','eligibility','posting_status')) or
 (p_action='accept' and cardinality(p_fields)=0) or (p_action='dismiss' and cardinality(p_fields)<>0)
 then raise exception 'Invalid public field review' using errcode='22023';end if;
 select coalesce(array_agg(x order by x),array[]::text[]) into fields from unnest(p_fields) x;
 select * into proposal from public.research_proposals where owner_id=uid and id=p_id for update;
 if not found then raise exception 'Proposal not found' using errcode='P0002';end if;
 if proposal.status<>'pending' then
  if proposal.receipt->>'action'=p_action and proposal.receipt->'fields'=to_jsonb(fields) then return proposal.receipt||jsonb_build_object('status','replay');end if;
  raise exception 'Already resolved differently' using errcode='40001';
 end if;
 select * into o from public.opportunities where owner_id=uid and id=proposal.opportunity_id for update;
 if p_expected is distinct from o.revision then raise exception 'Stale review' using errcode='40001';end if;
 eligibility_value:=case proposal.proposed_public_snapshot->>'classification' when 'confirmed' then 'eligible' when 'conditional' then 'conditional' when 'pending' then 'pending' when 'ineligible' then 'ineligible' else null end;
 if ('title'=any(fields) and coalesce(length(trim(proposal.proposed_public_snapshot->>'title')),0)=0) or
 ('organization'=any(fields) and coalesce(length(trim(proposal.proposed_public_snapshot->>'organization')),0)=0) or
 ('eligibility'=any(fields) and eligibility_value is null) or
 ('posting_status'=any(fields) and proposal.proposed_public_snapshot->>'classification'<>'closed') then
 raise exception 'Unknown evidence cannot clear a reviewed value' using errcode='22023';end if;
 changed:=o;
 if p_action='accept' then
  update public.opportunities set
  title=case when 'title'=any(fields) then proposal.proposed_public_snapshot->>'title' else title end,
  organization=case when 'organization'=any(fields) then proposal.proposed_public_snapshot->>'organization' else organization end,
  eligibility=case when 'eligibility'=any(fields) then eligibility_value else eligibility end,
  posting_status=case when 'posting_status'=any(fields) then 'closed' else posting_status end,
  revision=revision+1,updated_at=now() where id=o.id returning * into changed;
  insert into public.change_history(owner_id,opportunity_id,actor,operation,before_value,after_value)
  values(uid,o.id,'website_owner','research_public_approved',to_jsonb(o),to_jsonb(changed));
  insert into tracker_private.outbox(owner_id,opportunity_id,event_key,operation)
  values(uid,o.id,proposal.id::text||':approved','opportunity_changed');
 end if;
 result:=jsonb_build_object('status',case when p_action='accept' then 'accepted' else 'dismissed' end,'action',p_action,'fields',to_jsonb(fields),'opportunity_id',o.id,'revision',changed.revision);
 update public.research_proposals set status=case when p_action='accept' then 'accepted' else 'dismissed' end,receipt=result where id=p_id;
 return result;
end $$;
revoke all on function public.resolve_research_proposal(uuid,int,text,text[]) from public,anon;
grant execute on function public.resolve_research_proposal(uuid,int,text,text[]) to authenticated;

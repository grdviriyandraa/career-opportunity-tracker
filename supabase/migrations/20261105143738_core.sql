-- Apply using the Supabase SQL editor/admin migration connection. Never run with a browser key.
create schema if not exists tracker_private;
revoke all on schema tracker_private from public;
create table public.profiles (
 owner_id uuid primary key references auth.users(id), singleton boolean not null default true unique check(singleton),
 timezone text not null default 'Asia/Jakarta', max_work_hours numeric not null default 20 check(max_work_hours>=0),
 total_capacity numeric check(total_capacity>=0)
);
create table public.opportunities (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(owner_id),
 category text check(category in ('job','bootcamp','competition')), title text check(length(title)<=300), organization text,
 source_url text, source_text text, canonical_url text,
 personal_stage text not null default 'saved' check(personal_stage in ('saved','preparing','applied','interview','accepted','rejected','withdrawn')),
 posting_status text not null default 'unknown' check(posting_status in ('unknown','open','closed','expired')),
 eligibility text not null default 'unknown' check(eligibility in ('unknown','pending','eligible','conditional','ineligible')),
 notes text not null default '', employer_hours numeric check(employer_hours between 0 and 168), actual_date date,
 archived_at timestamptz, revision integer not null default 1 check(revision>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(owner_id,canonical_url), unique(owner_id,id)
);
create index opportunities_listing on public.opportunities(owner_id,created_at desc,id);
create table public.milestones (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null, opportunity_id uuid not null,
 title text not null check(length(title) between 1 and 300), kind text not null check(kind in ('deadline','event')),
 precision text not null check(precision in ('date','instant')), date date, start_at timestamptz, end_at timestamptz,
 timezone text not null, attendance text not null check(attendance in ('confirmed','conditional','unknown')),
 revision integer not null default 1,
 foreign key(owner_id,opportunity_id) references public.opportunities(owner_id,id),
 check((precision='date' and date is not null and start_at is null and end_at is null) or
 (precision='instant' and date is null and start_at is not null and
 ((kind='deadline' and end_at is null) or (kind='event' and end_at is not null and end_at>start_at))))
);
create index milestones_owner_date on public.milestones(owner_id,date,start_at);
create table public.change_history (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(owner_id),
 opportunity_id uuid not null references public.opportunities(id), actor text not null default 'website_owner',
 operation text not null, before_value jsonb, after_value jsonb, created_at timestamptz not null default now()
);
create table tracker_private.outbox (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.profiles(owner_id),
 opportunity_id uuid not null references public.opportunities(id), event_key text not null unique,
 operation text not null, status text not null default 'blocked', attempts int not null default 0,
 next_attempt_at timestamptz not null default now(), lease_until timestamptz, created_at timestamptz not null default now()
);
create table tracker_private.capture_receipts (
 owner_id uuid not null references public.profiles(owner_id), key uuid not null, payload_hash text not null,
 receipt jsonb not null, created_at timestamptz not null default now(), primary key(owner_id,key)
);
-- Client reads use RLS. All writes go through narrowly scoped transactional functions.
do $$ declare t text; begin
 foreach t in array array['profiles','opportunities','milestones','change_history'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy owner_read on public.%I for select to authenticated using (owner_id = auth.uid())',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;
create function tracker_private.require_owner() returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); begin
 if uid is null or not exists(select 1 from public.profiles where owner_id=uid) then
 raise exception 'Owner required' using errcode='42501'; end if; return uid; end $$;
create function public.capture_draft(p_payload jsonb,p_key uuid,p_canonical text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=tracker_private.require_owner(); old tracker_private.capture_receipts; o public.opportunities;
 h text:=encode(sha256(convert_to(p_payload::text,'UTF8')),'hex'); result jsonb; created boolean:=false;
begin
 if p_key is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>65536 or
 (p_payload - array['source_url','source_text','title','category'])<>'{}'::jsonb or
 not (coalesce(length(trim(p_payload->>'title')),0)>0 or coalesce(length(trim(p_payload->>'source_url')),0)>0 or coalesce(length(trim(p_payload->>'source_text')),0)>0)
 then raise exception 'Invalid capture' using errcode='22023'; end if;
 if length(p_payload->>'source_text')>20000 or length(p_payload->>'title')>300 or length(p_payload->>'source_url')>2048 then raise exception 'Capture too large' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 select * into old from tracker_private.capture_receipts where owner_id=uid and key=p_key;
 if found then if old.payload_hash<>h then raise exception 'Idempotency conflict' using errcode='40001'; end if; return old.receipt; end if;
 if p_canonical is not null then select * into o from public.opportunities where owner_id=uid and canonical_url=p_canonical; end if;
 if o.id is null then
  insert into public.opportunities(owner_id,category,title,source_url,source_text,canonical_url)
  values(uid,p_payload->>'category',p_payload->>'title',p_payload->>'source_url',p_payload->>'source_text',p_canonical) returning * into o;
  created:=true;
  insert into public.change_history(owner_id,opportunity_id,operation,after_value) values(uid,o.id,'capture',to_jsonb(o));
  insert into tracker_private.outbox(owner_id,opportunity_id,event_key,operation) values(uid,o.id,o.id::text||':1:capture','extraction_manual_required');
 end if;
 result:=jsonb_build_object('outcome',case when created then 'created' else 'existing' end,'opportunity_id',o.id,'revision',o.revision,'saved_at',o.created_at,'extraction_status','manual_required');
 insert into tracker_private.capture_receipts(owner_id,key,payload_hash,receipt) values(uid,p_key,h,result);
 return result;
end $$;
create function public.update_opportunity(p_id uuid,p_patch jsonb) returns public.opportunities
language plpgsql security definer set search_path='' as $$
declare uid uuid:=tracker_private.require_owner(); old public.opportunities; changed public.opportunities;
begin
 if jsonb_typeof(p_patch)<>'object' or (p_patch-array['expected_revision','title','category','organization','personal_stage','posting_status','eligibility','notes','employer_hours','archived','actual_date'])<>'{}'::jsonb then raise exception 'Invalid patch' using errcode='22023'; end if;
 select * into old from public.opportunities where id=p_id and owner_id=uid for update;
 if not found then raise exception 'Not found' using errcode='P0002'; end if;
 if (p_patch->>'expected_revision')::int is distinct from old.revision then raise exception 'Revision conflict' using errcode='40001'; end if;
 if p_patch->>'personal_stage'='applied' and not(p_patch?'actual_date') then raise exception 'Actual date required' using errcode='22023'; end if;
 update public.opportunities set
 title=case when p_patch?'title' then p_patch->>'title' else title end,
 category=case when p_patch?'category' then p_patch->>'category' else category end,
 organization=case when p_patch?'organization' then p_patch->>'organization' else organization end,
 personal_stage=coalesce(p_patch->>'personal_stage',personal_stage),
 posting_status=coalesce(p_patch->>'posting_status',posting_status), eligibility=coalesce(p_patch->>'eligibility',eligibility),
 notes=coalesce(p_patch->>'notes',notes),
 employer_hours=case when p_patch?'employer_hours' then (p_patch->>'employer_hours')::numeric else employer_hours end,
 actual_date=case when p_patch?'actual_date' then (p_patch->>'actual_date')::date else actual_date end,
 archived_at=case when p_patch?'archived' then case when (p_patch->>'archived')::boolean then now() else null end else archived_at end,
 revision=revision+1,updated_at=now() where id=p_id and owner_id=uid returning * into changed;
 insert into public.change_history(owner_id,opportunity_id,operation,before_value,after_value) values(uid,p_id,'update',to_jsonb(old),to_jsonb(changed));
 insert into tracker_private.outbox(owner_id,opportunity_id,event_key,operation) values(uid,p_id,p_id::text||':'||changed.revision||':update',case when changed.archived_at is not null or changed.personal_stage in ('rejected','withdrawn') then 'calendar_cleanup_review' else 'opportunity_changed' end);
 return changed;
end $$;
create function public.add_milestone(p_id uuid,p_payload jsonb) returns public.milestones
language plpgsql security definer set search_path='' as $$
declare uid uuid:=tracker_private.require_owner(); o public.opportunities; m public.milestones;
begin
 if jsonb_typeof(p_payload)<>'object' or (p_payload-array['expected_revision','title','kind','precision','date','start_at','end_at','timezone','attendance'])<>'{}'::jsonb then raise exception 'Invalid milestone' using errcode='22023';end if;
 if not exists(select 1 from pg_timezone_names where name=p_payload->>'timezone') then raise exception 'Invalid timezone' using errcode='22023';end if;
 select * into o from public.opportunities where id=p_id and owner_id=uid for update;
 if not found then raise exception 'Not found' using errcode='P0002';end if;
 if (p_payload->>'expected_revision')::int is distinct from o.revision then raise exception 'Revision conflict' using errcode='40001';end if;
 insert into public.milestones(owner_id,opportunity_id,title,kind,precision,date,start_at,end_at,timezone,attendance)
 values(uid,p_id,p_payload->>'title',p_payload->>'kind',p_payload->>'precision',(p_payload->>'date')::date,(p_payload->>'start_at')::timestamptz,(p_payload->>'end_at')::timestamptz,p_payload->>'timezone',coalesce(p_payload->>'attendance','unknown')) returning * into m;
 update public.opportunities set revision=revision+1,updated_at=now() where id=p_id;
 insert into public.change_history(owner_id,opportunity_id,operation,after_value) values(uid,p_id,'milestone_added',to_jsonb(m));
 insert into tracker_private.outbox(owner_id,opportunity_id,event_key,operation) values(uid,p_id,m.id::text||':1','milestone_changed');
 return m;
end $$;
revoke all on function public.capture_draft(jsonb,uuid,text),public.update_opportunity(uuid,jsonb),public.add_milestone(uuid,jsonb) from public, anon;
grant execute on function public.capture_draft(jsonb,uuid,text),public.update_opportunity(uuid,jsonb),public.add_milestone(uuid,jsonb) to authenticated;

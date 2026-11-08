-- Prevent a manual admin run from overlapping with the scheduled global run.
-- A lock token makes a late-finishing stale invocation unable to release a
-- newer invocation's lock.

create table if not exists public.cron_run_lock (
  name text primary key check (name = 'global'),
  token uuid not null,
  acquired_at timestamptz not null default now()
);

alter table public.cron_run_lock enable row level security;

create or replace function public.jr_acquire_cron_run_lock(
  p_token uuid,
  p_stale_after_seconds integer default 600
)
returns boolean
language sql
security definer
set search_path = public
as $$
  with acquired as (
    insert into public.cron_run_lock (name, token, acquired_at)
    values ('global', p_token, now())
    on conflict (name) do update
      set token = excluded.token,
          acquired_at = excluded.acquired_at
      where public.cron_run_lock.acquired_at < now()
        - make_interval(secs => greatest(p_stale_after_seconds, 300))
    returning 1
  )
  select exists (select 1 from acquired);
$$;

create or replace function public.jr_release_cron_run_lock(p_token uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.cron_run_lock
  where name = 'global' and token = p_token;
$$;

revoke all on table public.cron_run_lock from anon, authenticated;
revoke all on function public.jr_acquire_cron_run_lock(uuid, integer) from public;
revoke all on function public.jr_release_cron_run_lock(uuid) from public;
grant execute on function public.jr_acquire_cron_run_lock(uuid, integer) to service_role;
grant execute on function public.jr_release_cron_run_lock(uuid) to service_role;

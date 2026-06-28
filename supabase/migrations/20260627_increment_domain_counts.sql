-- Run this manually in the Supabase SQL editor (Dashboard → SQL Editor).
-- This repo doesn't have the Supabase CLI / migrations wired up yet, so
-- there's no automated path to apply this — it's not picked up by any
-- build or deploy step.
--
-- Backs Finding D (fix/atomic-domain-counts-flush): replaces the app-side
-- read-modify-write in flushDomainCountsToDB() with a single atomic UPDATE,
-- so two overlapping cron runs add their counts instead of one silently
-- clobbering the other's increments.
--
-- NOTE on the brief's suggested version of this function: it built the
-- result via `jsonb_object_agg(key, ...) FROM jsonb_object_keys(increments)`,
-- which only emits keys present in `increments`. That silently DROPS every
-- existing host in domain_counts that wasn't fetched in the current run —
-- a real data-loss bug, not just a style nit. This version unions the key
-- sets (existing ∪ incoming) via `coalesce(domain_counts, '{}') || increments`
-- so untouched hosts are carried forward unchanged.
create or replace function public.increment_domain_counts(increments jsonb)
returns void
language sql
set search_path = ''
as $$
  update public.app_config as t
  set domain_counts = (
    select jsonb_object_agg(
      key,
      coalesce((t.domain_counts ->> key)::bigint, 0) + coalesce((increments ->> key)::bigint, 0)
    )
    from jsonb_object_keys(coalesce(t.domain_counts, '{}'::jsonb) || increments) as key
  ),
  updated_at = now()
  where t.id = 1;
$$;

comment on function public.increment_domain_counts(jsonb) is
  'Atomically adds each {host: count} pair in `increments` onto app_config.domain_counts (id=1), preserving any existing host not present in this call. Used by flushDomainCountsToDB() in src/lib/sources/ats-utils.ts so overlapping cron runs add instead of overwrite.';

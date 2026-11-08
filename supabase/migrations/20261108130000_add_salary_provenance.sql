-- Preserve salary reports in their submitted currency while recording any USD
-- conversion as a separate, auditable snapshot. Existing amount columns remain
-- in place so this migration does not reinterpret legacy EUR/GBP values.

alter table public.salary_reports
  add column if not exists source text not null default 'user',
  add column if not exists source_record_key text,
  add column if not exists original_amount numeric(14, 2),
  add column if not exists original_currency text,
  add column if not exists usd_amount numeric(14, 2),
  add column if not exists usd_conversion_rate numeric(20, 10),
  add column if not exists usd_rate_as_of date,
  add column if not exists usd_rate_source text;

comment on column public.salary_reports.source is
  'Origin of the report, such as user or egytech.';
comment on column public.salary_reports.source_record_key is
  'Stable source-specific identity used only for idempotent imports.';
comment on column public.salary_reports.original_amount is
  'Submitted amount in original_currency; never overwritten by USD conversion.';
comment on column public.salary_reports.usd_amount is
  'USD snapshot recorded at ingestion when the original currency and rate are known.';
comment on column public.salary_reports.usd_conversion_rate is
  'USD per unit of original_currency used for usd_amount.';
comment on column public.salary_reports.usd_rate_as_of is
  'Effective date of usd_conversion_rate, not the query date.';
comment on column public.salary_reports.usd_rate_source is
  'Provider or documented source used to obtain usd_conversion_rate.';

-- Preserve only values whose legacy columns have an unambiguous meaning. EUR
-- and GBP rows intentionally stay null here: legacy writes could place either
-- currency in either amount column, so guessing would corrupt their history.
update public.salary_reports
set
  original_amount = case
    when currency = 'EGP' then salary_egp
    when currency = 'USD' then salary_usd
  end,
  original_currency = currency
where original_amount is null
  and (
    (currency = 'EGP' and salary_egp is not null)
    or (currency = 'USD' and salary_usd is not null)
  );

-- A legacy USD amount is already a verifiable USD conversion with rate 1. Do
-- not synthesize rates for legacy EGP/EUR/GBP data; those rows stay reviewable
-- but out of the normalized USD aggregate until their provenance is known.
update public.salary_reports
set
  usd_amount = round(salary_usd::numeric, 2),
  usd_conversion_rate = 1,
  usd_rate_as_of = reported_at::date,
  usd_rate_source = 'legacy-usd-original'
where usd_amount is null
  and currency = 'USD'
  and salary_usd is not null;

-- A source key is nullable for user reports. PostgreSQL permits multiple NULL
-- values in a unique index, while a concrete source key makes the one-off
-- import idempotent and works with Supabase's regular upsert conflict target.
create unique index if not exists salary_reports_source_record_key_unique
  on public.salary_reports (source, source_record_key);

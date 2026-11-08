-- Public company visibility is opt-in. Existing catalogue rows remain private
-- by default and no scraping/fetch behavior changes.
alter table public.ats_companies
  add column if not exists is_featured boolean not null default false;

comment on column public.ats_companies.is_featured is
  'Admin-controlled opt-in for the public featured-companies directory.';

create index if not exists ats_companies_featured_name_idx
  on public.ats_companies (name)
  where is_featured = true;

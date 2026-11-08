-- Keep only catalog entries with a working public ATS feed in the scheduled
-- pool. These three endpoints were verified as unavailable or non-JSON on
-- 2026-11-08; the rows remain available for later correction in the admin UI.
update public.ats_companies
set
  is_active = false,
  updated_at = now()
where is_active = true
  and (
    (ats = 'workable' and slug = 'wirecardbrasil')
    or (ats = 'breezy' and slug = 'bendyworks')
    or (ats = 'bamboohr' and slug = 'compeon')
  );

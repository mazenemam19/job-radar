-- Adds normalized, posting-level attributes while retaining the legacy columns.

alter table public.raw_jobs
  add column if not exists source_location text,
  add column if not exists country_code text,
  add column if not exists city text,
  add column if not exists workplace_type text not null default 'unknown',
  add column if not exists employment_types text[] not null default '{}',
  add column if not exists work_authorization_status text not null default 'unclear',
  add column if not exists work_authorization_evidence text,
  add column if not exists language_requirements text[] not null default '{}',
  add column if not exists language_evidence text;

update public.raw_jobs as job
set
  source_location = coalesce(job.source_location, job.location),
  country_code = coalesce(
    job.country_code,
    case
      when job.location ~* '\m(germany|deutschland|berlin|hamburg|munich|münchen|nuremberg|nürnberg|erlangen|buckenhof|frankfurt|stuttgart|cologne|köln)\M'
        or job.location ~* '(^|[,[:space:]])DE([,[:space:]]|$)' then 'DE'
      when job.location ~* '\m(egypt|cairo|giza|alexandria)\M'
        or job.location ~* '(^|[,[:space:]])EG([,[:space:]]|$)' then 'EG'
      when job.location ~* '\m(united kingdom|uk|london|edinburgh|manchester)\M'
        or job.location ~* '(^|[,[:space:]])(GB|UK)([,[:space:]]|$)' then 'GB'
      when job.location ~* '\m(united states|united states of america|usa)\M'
        or job.location ~* '(^|[,[:space:]])US([,[:space:]]|$)' then 'US'
      when job.location ~* '\m(france|paris)\M' then 'FR'
      when job.location ~* '\m(netherlands|amsterdam)\M' then 'NL'
      when job.location ~* '\m(ireland|dublin)\M' then 'IE'
      when job.location ~* '\m(spain|madrid|barcelona)\M' then 'ES'
      when job.location ~* '\m(portugal|lisbon)\M' then 'PT'
      when job.location ~* '\m(sweden|stockholm)\M' then 'SE'
      when job.location ~* '\m(denmark|copenhagen)\M' then 'DK'
      when job.location ~* '\m(finland|helsinki)\M' then 'FI'
      when job.location ~* '\m(poland|warsaw)\M' then 'PL'
      when job.location ~* '\m(austria|vienna)\M' then 'AT'
      when job.location ~* '\m(switzerland|zurich|geneva)\M' then 'CH'
      when job.location ~* '\m(belgium|brussels)\M' then 'BE'
      when job.location ~* '\m(norway|oslo)\M' then 'NO'
      when job.location ~* '\m(canada|toronto)\M' then 'CA'
      when job.location ~* '\m(australia|sydney)\M' then 'AU'
      when job.location ~* '\m(singapore)\M' then 'SG'
      when job.location ~* '\m(saudi arabia|riyadh)\M' then 'SA'
      when job.location ~* '\m(united arab emirates|uae|dubai)\M' then 'AE'
      when job.location ~* '\m(romania|bucharest)\M' then 'RO'
      when job.location ~* '\m(hungary|budapest)\M' then 'HU'
      when job.location ~* '\m(czechia|czech republic|prague)\M' then 'CZ'
      when job.location ~* '\m(italy|rome)\M' then 'IT'
      else null
    end
  ),
  city = coalesce(
    job.city,
    case
      when job.location ~* '\m(remote|worldwide|global|anywhere|multiple locations)\M' then null
      when lower(btrim(split_part(job.location, ',', 1))) = any(array[
        'germany', 'deutschland', 'egypt', 'united kingdom', 'uk', 'united states', 'usa',
        'france', 'netherlands', 'ireland', 'spain', 'portugal', 'sweden', 'denmark',
        'finland', 'poland', 'austria', 'switzerland', 'belgium', 'norway', 'canada',
        'australia', 'singapore', 'saudi arabia', 'united arab emirates', 'romania',
        'hungary', 'czechia', 'czech republic', 'italy'
      ]) then null
      else nullif(btrim(split_part(job.location, ',', 1)), '')
    end
  ),
  workplace_type = case
    when job.is_remote then 'remote'
    when (job.title || ' ' || job.location) ~* '\mhybrid\M' then 'hybrid'
    when (job.title || ' ' || job.location) ~* '\m(on[ -]?site|in-office|office-based)\M' then 'on_site'
    else coalesce(job.workplace_type, 'unknown')
  end,
  employment_types = case
    when cardinality(job.employment_types) > 0 then job.employment_types
    else array_remove(array[
      case when (job.title || ' ' || job.description) ~* '\m(werkstudent(in)?|working student|student employee)\M' then 'working_student' end,
      case when (job.title || ' ' || job.description) ~* '\m(part[ -]?time|teilzeit)\M' then 'part_time' end,
      case when (job.title || ' ' || job.description) ~* '\m(full[ -]?time|vollzeit)\M' then 'full_time' end,
      case when (job.title || ' ' || job.description) ~* '\m(internship|intern|praktikum|praktikant(in)?)\M' then 'internship' end,
      case when (job.title || ' ' || job.description) ~* '\m(mini[ -]?job|minijob)\M' then 'mini_job' end,
      case when (job.title || ' ' || job.description) ~* '\m(apprenticeship|ausbildung|trainee program)\M' then 'apprenticeship' end,
      case when (job.title || ' ' || job.description) ~* '\m(contractor?|fixed[ -]term contract)\M' then 'contract' end,
      case when (job.title || ' ' || job.description) ~* '\m(temporary|befristet)\M' then 'temporary' end,
      case when (job.title || ' ' || job.description) ~* '\m(freelance|freiberuflich)\M' then 'freelance' end
    ], null)
  end,
  work_authorization_status = case
    when (job.title || ' ' || job.description) ~* '\m(no (visa )?sponsorship|sponsorship (is )?(not available|unavailable|not offered|not provided)|cannot sponsor|unable to sponsor|will not sponsor|without (visa )?sponsorship)\M'
      then 'sponsorship_unavailable'
    when (job.title || ' ' || job.description) ~* '\m((visa )?sponsorship (is )?(available|offered|provided|supported)|we (can|will|do) sponsor|eligible for (visa )?sponsorship)\M'
      then 'sponsorship_available'
    when (job.title || ' ' || job.description) ~* '\m(work authorization (is )?required|right to work (is )?required|must have (valid )?work authorization|must be authorized to work)\M'
      then 'authorization_required'
    when job.visa_sponsorship then 'sponsorship_available'
    else 'unclear'
  end;

update public.raw_jobs as job
set
  country = case job.country_code
    when 'DE' then 'Germany'
    when 'EG' then 'Egypt'
    when 'GB' then 'UK'
    when 'US' then 'USA'
    when 'FR' then 'France'
    when 'NL' then 'Netherlands'
    when 'IE' then 'Ireland'
    when 'ES' then 'Spain'
    when 'PT' then 'Portugal'
    when 'SE' then 'Sweden'
    when 'DK' then 'Denmark'
    when 'FI' then 'Finland'
    when 'PL' then 'Poland'
    when 'AT' then 'Austria'
    when 'CH' then 'Switzerland'
    when 'BE' then 'Belgium'
    when 'NO' then 'Norway'
    when 'CA' then 'Canada'
    when 'AU' then 'Australia'
    when 'SG' then 'Singapore'
    when 'SA' then 'Saudi Arabia'
    when 'AE' then 'UAE'
    when 'RO' then 'Romania'
    when 'HU' then 'Hungary'
    when 'CZ' then 'Czechia'
    when 'IT' then 'Italy'
    else 'Unknown'
  end,
  country_flag = case job.country_code
    when 'DE' then '🇩🇪'
    when 'EG' then '🇪🇬'
    when 'GB' then '🇬🇧'
    when 'US' then '🇺🇸'
    when 'FR' then '🇫🇷'
    when 'NL' then '🇳🇱'
    when 'IE' then '🇮🇪'
    when 'ES' then '🇪🇸'
    when 'PT' then '🇵🇹'
    when 'SE' then '🇸🇪'
    when 'DK' then '🇩🇰'
    when 'FI' then '🇫🇮'
    when 'PL' then '🇵🇱'
    when 'AT' then '🇦🇹'
    when 'CH' then '🇨🇭'
    when 'BE' then '🇧🇪'
    when 'NO' then '🇳🇴'
    when 'CA' then '🇨🇦'
    when 'AU' then '🇦🇺'
    when 'SG' then '🇸🇬'
    when 'SA' then '🇸🇦'
    when 'AE' then '🇦🇪'
    when 'RO' then '🇷🇴'
    when 'HU' then '🇭🇺'
    when 'CZ' then '🇨🇿'
    when 'IT' then '🇮🇹'
    else '🌍'
  end,
  visa_sponsorship = (job.work_authorization_status = 'sponsorship_available');

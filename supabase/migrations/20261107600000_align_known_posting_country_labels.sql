-- Existing rows used the ATS company's country and flag as display values.
-- Once a posting's country_code is known, display the posting location instead.
-- Unknown country codes intentionally retain their original source labels.

with country_labels(country_code, country, country_flag) as (
  values
    ('DE', 'Germany', '🇩🇪'), ('EG', 'Egypt', '🇪🇬'), ('GB', 'UK', '🇬🇧'),
    ('US', 'USA', '🇺🇸'), ('FR', 'France', '🇫🇷'), ('NL', 'Netherlands', '🇳🇱'),
    ('IE', 'Ireland', '🇮🇪'), ('ES', 'Spain', '🇪🇸'), ('PT', 'Portugal', '🇵🇹'),
    ('SE', 'Sweden', '🇸🇪'), ('DK', 'Denmark', '🇩🇰'), ('FI', 'Finland', '🇫🇮'),
    ('PL', 'Poland', '🇵🇱'), ('AT', 'Austria', '🇦🇹'), ('CH', 'Switzerland', '🇨🇭'),
    ('BE', 'Belgium', '🇧🇪'), ('NO', 'Norway', '🇳🇴'), ('CA', 'Canada', '🇨🇦'),
    ('AU', 'Australia', '🇦🇺'), ('SG', 'Singapore', '🇸🇬'), ('SA', 'Saudi Arabia', '🇸🇦'),
    ('AE', 'UAE', '🇦🇪'), ('RO', 'Romania', '🇷🇴'), ('HU', 'Hungary', '🇭🇺'),
    ('CZ', 'Czechia', '🇨🇿'), ('IT', 'Italy', '🇮🇹'), ('JP', 'Japan', '🇯🇵'),
    ('ZA', 'South Africa', '🇿🇦'), ('GI', 'Gibraltar', '🇬🇮'), ('MX', 'Mexico', '🇲🇽'),
    ('AR', 'Argentina', '🇦🇷'), ('BR', 'Brazil', '🇧🇷'), ('IN', 'India', '🇮🇳'),
    ('ID', 'Indonesia', '🇮🇩')
)
update public.raw_jobs as job
set
  country = labels.country,
  country_flag = labels.country_flag
from country_labels as labels
where upper(job.country_code) = labels.country_code
  and (
    job.country is distinct from labels.country
    or job.country_flag is distinct from labels.country_flag
  );

-- Cached job cards contain the legacy labels. Rebuild them on the next
-- dashboard visit so they use the corrected posting-level display data.
update public.user_jobs_cache
set cached_at = '2000-01-01T00:00:00Z';

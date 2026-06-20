-- supabase/migrations/004_dynamic_filters.sql

-- Add columns to default_settings
ALTER TABLE public.default_settings
ADD COLUMN IF NOT EXISTS excluded_keywords TEXT[] NOT NULL DEFAULT ARRAY[
  'backend', 'back-end', 'fullstack', 'full-stack', 'devops', 'dev-ops', 'sre', 'site reliability',
  'platform engineer', 'infrastructure', 'cloud engineer', 'security engineer', 'network engineer',
  'embedded', 'firmware', 'mlops', 'ml-ops', 'database reliability', 'dbre', 'database engineer',
  'dba', 'sysadmin', 'system administrator', 'data engineer', 'data scientist', 'data analyst',
  'machine learning', 'project manager', 'program manager', 'product manager', 'product owner',
  'account manager', 'scrum master', 'operations manager', 'sales manager', 'business analyst',
  'customer success', 'support engineer', 'helpdesk', 'help desk', 'service desk', 'recruiter',
  'hr manager', 'finance', 'accountant', 'marketing', 'compliance', 'product designer',
  'ux designer', 'quality assurance', 'automation tester', 'test engineer', 'hardware'
],
ADD COLUMN IF NOT EXISTS blacklisted_locations TEXT[] NOT NULL DEFAULT ARRAY[
  'israel', 'tel aviv', 'tel-aviv', 'haifa', 'herzliya', 'jerusalem', 'ra''anana',
  'us only', 'usa only', 'united states only', 'uk only', 'united kingdom only',
  'canada only', 'europe only', 'americas only', 'amer only', 'latam only', 'apac only',
  'security clearance required', 'must be a us citizen', 'us citizenship required',
  'cannot provide visa sponsorship', 'unable to provide visa sponsorship',
  'we are unable to offer visa', 'no visa sponsorship', 'unable to sponsor'
],
ADD COLUMN IF NOT EXISTS required_keywords TEXT[] NOT NULL DEFAULT ARRAY[
  'react', 'next.js', 'react native', 'react.js', 'reactjs'
];

-- Add columns to user_settings
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS excluded_keywords TEXT[],
ADD COLUMN IF NOT EXISTS blacklisted_locations TEXT[],
ADD COLUMN IF NOT EXISTS required_keywords TEXT[];

-- Update the existing default row (id = 1) to populate the new defaults if they are empty
UPDATE public.default_settings
SET
  excluded_keywords = ARRAY[
    'backend', 'back-end', 'fullstack', 'full-stack', 'devops', 'dev-ops', 'sre', 'site reliability',
    'platform engineer', 'infrastructure', 'cloud engineer', 'security engineer', 'network engineer',
    'embedded', 'firmware', 'mlops', 'ml-ops', 'database reliability', 'dbre', 'database engineer',
    'dba', 'sysadmin', 'system administrator', 'data engineer', 'data scientist', 'data analyst',
    'machine learning', 'project manager', 'program manager', 'product manager', 'product owner',
    'account manager', 'scrum master', 'operations manager', 'sales manager', 'business analyst',
    'customer success', 'support engineer', 'helpdesk', 'help desk', 'service desk', 'recruiter',
    'hr manager', 'finance', 'accountant', 'marketing', 'compliance', 'product designer',
    'ux designer', 'quality assurance', 'automation tester', 'test engineer', 'hardware'
  ],
  blacklisted_locations = ARRAY[
    'israel', 'tel aviv', 'tel-aviv', 'haifa', 'herzliya', 'jerusalem', 'ra''anana',
    'us only', 'usa only', 'united states only', 'uk only', 'united kingdom only',
    'canada only', 'europe only', 'americas only', 'amer only', 'latam only', 'apac only',
    'security clearance required', 'must be a us citizen', 'us citizenship required',
    'cannot provide visa sponsorship', 'unable to provide visa sponsorship',
    'we are unable to offer visa', 'no visa sponsorship', 'unable to sponsor'
  ],
  required_keywords = ARRAY[
    'react', 'next.js', 'react native', 'react.js', 'reactjs'
  ]
WHERE id = 1;

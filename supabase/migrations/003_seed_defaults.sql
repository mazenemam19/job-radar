-- ============================================================
-- Job Radar v2 – Seed default_settings
-- Values match the hardcoded constants in src/lib/constants.ts
-- exactly (verified against the production codebase).
-- ============================================================

INSERT INTO public.default_settings (
  id,
  expert_skills,
  secondary_skills,
  bonus_skills,
  job_age_days,
  pipeline_visa,
  pipeline_local,
  pipeline_global,
  seniority_allow_mid,
  gemini_filter_prompt,
  scoring_weights,
  score_denominator,
  updated_at
) VALUES (
  1,
  -- EXPERT_SKILLS: ×3 weight, denominator = 18 (15 skills × 3 = 45 max raw, /18 normalized)
  ARRAY[
    'React','TypeScript','JavaScript','HTML','CSS','Redux',
    'React Query','Zustand','MobX','Tailwind','Material UI',
    'Sass','Next.js','Vite','Webpack'
  ],
  -- SECONDARY_SKILLS: ×1 weight
  ARRAY[
    'Jest','Vitest','Testing Library','React Native',
    'GraphQL','WebSockets','Storybook'
  ],
  -- BONUS_SKILLS: unscored (used for display only in old code)
  ARRAY[
    'Node.js','Express','MongoDB','PostgreSQL','AWS',
    'Docker','Git','Redis','Kubernetes'
  ],
  7,    -- job_age_days
  TRUE, -- pipeline_visa
  TRUE, -- pipeline_local
  TRUE, -- pipeline_global
  FALSE,-- seniority_allow_mid (old code: strictly senior for local, mid allowed for visa/global)
  -- gemini_filter_prompt: matches the prompt in src/lib/gemini.ts
  -- Paste your actual Gemini filter prompt here after migration.
  -- It should evaluate: location relevance, tech stack fit, seniority,
  -- BDS/Israel policy, and company culture signals.
  -- The placeholder below is a functional default that users can override.
  $PROMPT$You are a job filter for a Senior React/Next.js engineer based in Egypt.
Analyze this batch of job listings and return ONLY those that pass ALL criteria:

1. TECH STACK: Must primarily require React and/or TypeScript. Reject backend-only, mobile-only, or non-frontend roles.
2. SENIORITY: Senior or higher (5+ years implied). Reject junior/mid unless the role is labeled "Mid-Senior" or "Senior+".
3. LOCATION: Accept fully remote, EU/UK with relocation, or Egypt-based roles. Reject US-only, requires-relocation-to-US, or roles explicitly excluding non-EU applicants.
4. BDS: Reject any role at a company with significant operations in Israel (development centers, HQ, etc.).
5. CULTURE: Reject descriptions containing: "rockstar", "ninja", "hustle culture", "high pressure", "unlimited hours".

For each job, return a JSON object: { "id": "<job_id>", "pass": true/false, "reason": "<one sentence>" }
Return a JSON array of these objects. No markdown, no preamble.$PROMPT$,
  '{"skill":0.6,"recency":0.3,"relocation":0.1}',
  18,   -- score_denominator
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  expert_skills        = EXCLUDED.expert_skills,
  secondary_skills     = EXCLUDED.secondary_skills,
  bonus_skills         = EXCLUDED.bonus_skills,
  job_age_days         = EXCLUDED.job_age_days,
  pipeline_visa        = EXCLUDED.pipeline_visa,
  pipeline_local       = EXCLUDED.pipeline_local,
  pipeline_global      = EXCLUDED.pipeline_global,
  seniority_allow_mid  = EXCLUDED.seniority_allow_mid,
  gemini_filter_prompt = EXCLUDED.gemini_filter_prompt,
  scoring_weights      = EXCLUDED.scoring_weights,
  score_denominator    = EXCLUDED.score_denominator,
  updated_at           = NOW();

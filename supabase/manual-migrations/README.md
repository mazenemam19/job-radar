# Manual Supabase migrations

Files in this directory are intentionally excluded from `supabase db push`.
They require a reviewed backup, a quiet cron window, and explicit execution in
the Supabase SQL editor by an operator who has verified the target project.

`20261107400000_rekey_and_deduplicate_legacy_raw_jobs.sql` is destructive: it
deduplicates and changes `raw_jobs.id` values. It must not be copied back into
`supabase/migrations` or run automatically. The application writer has a
compatibility lookup, so it is safe to deploy before this one-time cleanup.

---
date: 2026-07-09
category: bugs
tags: [ats, teamtailor, json-feed, content-type, parsing]
files: [src/lib/sources/ats/http.ts, src/lib/sources/ats/teamtailor.ts, src/types/api.ts]
---

# Teamtailor's `jobs.json` now serves JSON Feed — content-type gate rejected it as non-JSON

Separate bug from the Workable thundering-herd series
(`issue-52-504-recurrence-part*.md`) — different fetcher, different root
cause, different files. Kept as its own doc on purpose.

## Symptoms

Full Fabric and Yodo1 — the only two `ats=teamtailor` companies in the DB —
both failed with `Non-JSON response (content-type: "application/feed+json")`
even though `https://{slug}.teamtailor.com/jobs.json` returns a real,
current, parseable JSON body (confirmed manually for Full Fabric: a live
"Technical Product Marketing Manager" posting with full
`schema.org/JobPosting` markup, posted June 2026). Full Fabric had
previously been misdiagnosed as a persistent isolated timeout
(`issue-52-429-404-followup-part3.md`, "Full Fabric ... genuine isolated
host issue") — that theory was wrong; it was this parser bug the whole time,
just masked by an earlier concurrency bug that produced a timeout on the
same host before the fetch ever got far enough to hit the content-type gate.

## Root Cause

`parseJsonBody()` in `http.ts` gated on:

```js
if (!contentType.includes("application/json")) { ... reject ... }
```

Teamtailor's public `jobs.json` responds with `Content-Type:
application/feed+json` for at least these two companies. The string
`"application/feed+json"` does not contain the substring
`"application/json"` — the `feed+` in the middle breaks the match — so a
valid, parseable JSON body got mislabeled "Non-JSON response" and discarded
before `teamtailor.ts` ever saw it.

The body itself is JSON Feed format (jsonfeed.org spec: `{version, title,
items: [...]}` per item: `id`, `url`, `title`, `content_html`,
`date_published`, plus a non-standard `_jobposting` extension carrying a
schema.org-style `jobLocation`) rather than the JSON:API-ish `{data: [...]}`
shape `teamtailor.ts` was written against. Even after loosening the
content-type gate, the old code would have hit the existing `Array.isArray`
shape guard (added for Yodo1's earlier, different failure — see
`issue-52-429-404-followup-part3.md`) and failed with "missing `data`
array" instead of parsing `items[]`.

Both fixes were needed together: neither the content-type gate nor the
shape guard alone would have surfaced real jobs from these two boards.

## What Didn't Work / Was Considered

- Special-casing the literal string `"application/feed+json"` in `http.ts`.
  Works for these two companies but doesn't generalize — any other ATS or
  future Teamtailor variant serving e.g. `application/vnd.api+json` or
  `application/ld+json` would hit the identical bug again.
- Only fixing `teamtailor.ts`'s shape guard without touching `http.ts`. Body
  never reaches the shape guard — `parseJsonBody` rejects it first.

## Solution

1. `http.ts`: match the MIME type (stripped of any `;charset=...` parameter)
   exactly against `application/json`, **or** accept any `+json` structured
   syntax suffix (RFC 6839 — the same mechanism behind
   `application/vnd.api+json`, `application/ld+json`, etc.). This is a
   general rule, not a Teamtailor special case, and doesn't loosen the gate
   for genuinely non-JSON bodies (`text/html` from a dead/WAF-challenged
   board still gets rejected exactly as before — verified by the existing
   `http-safe-fetch-json.test.ts` WAF-page test, unchanged).
2. `teamtailor.ts`: branch on shape after parsing — `data[]` (legacy) is
   tried first, then `items[]` (JSON Feed), then a shape error naming both
   if neither is present. Field mapping for the feed shape:
   `title`, `url`, `content_html` → `description` (via existing
   `stripHtml`), `date_published` → `postedAt` (empty string falls back to
   `processJobs`' existing "unknown date" handling, same as every other
   fetcher already relies on). `_jobposting.jobLocation` may be a plain
   string or a schema.org PostalAddress-shaped object — both handled, with
   a fallback to the company's configured `city`/`country` matching the
   legacy shape's existing fallback pattern.
3. Did not change `data[]` handling at all — zero risk to the legacy shape
   if any teamtailor company still serves it.

## Prevention

The `+json` suffix fix is the actual prevention: any future ATS response
using a `+json`-suffixed media type (a real, registered pattern per RFC
6839, not exotic) now parses correctly instead of needing its own special
case. `teamtailor-shape-guard.test.ts` now asserts both shapes and the
combined-failure case, so a regression in either branch fails a test instead
of silently dropping jobs in production again.

## Related

- `docs/solutions/bugs/issue-52-429-404-followup-part3.md` — where Yodo1's
  original `data[]`-shape crash was found and fixed, and where Full Fabric
  was (incorrectly) filed as a separate timeout issue.
- Yodo1 itself is being moved off the ATS pipeline entirely (handled
  internally per user decision) — this fix was verified against Full Fabric
  only; it is not blocked on or scoped to Yodo1.

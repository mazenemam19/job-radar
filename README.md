# 🎯 Job Radar

Frontend developer jobs with visa sponsorship — auto-scored against your CV.

## Setup

```bash
pnpm install
cp .env.local.example .env.local
# Edit .env.local with your keys
```

## Run

```bash
pnpm dev                 # Start dashboard at http://localhost:3000
pnpm run cron:now        # Run one immediate fetch (Arbeitnow + Remotive via Gemini)
pnpm run cron            # Run fetch every 6 hours
```

## Trigger via API

```bash
curl -X POST http://localhost:3000/api/cron \
  -H "x-cron-secret: YOUR_CRON_SECRET"
```

## Env Vars

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | From https://aistudio.google.com/apikey (free) |
| `SMTP_USER` | Gmail address |
| `SMTP_PASS` | 16-char Gmail App Password (not regular password) |
| `NOTIFY_TO` | Email to send job alerts to |
| `CRON_SECRET` | Any random string to protect /api/cron |
| `NEXT_PUBLIC_APP_URL` | Your app URL for email links |

## How It Works

1. **Arbeitnow**: Filters by `visa_sponsorship: true` (boolean, reliable)
2. **Remotive**: Uses Gemini AI to classify each job for visa sponsorship
3. Both sources: filter out citizenship/clearance requirements, zero skill overlap
4. Score = 60% skill match + 30% recency + 10% relocation bonus
5. Email alert sent when new jobs found
6. `data/jobs.json` stores up to 500 jobs, deduplicated

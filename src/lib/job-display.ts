// src/lib/job-display.ts
// Human-readable date labels for job listings. Shared between the dashboard
// job card and the job detail page so the two never drift out of sync.

import { normalizePostingLocation } from "./job-normalization";
import type { RawJob } from "./types";

/**
 * Display a posting's own source location, never the ATS company's legacy
 * country label. Older rows can have a correctly-normalized country_code but
 * a stale country/country_flag inherited from the company (for example a
 * Berlin posting shown with Finland's flag). Re-normalising the source field
 * at the display boundary keeps that historical redundancy from misleading a
 * job seeker while the additive data backfill catches up.
 */
export function formatJobLocation(
  job: Pick<RawJob, "location" | "source_location" | "title">,
): string {
  const sourceLocation = job.source_location?.trim() || job.location.trim();
  const normalized = normalizePostingLocation(sourceLocation, job.title);

  if (!sourceLocation) return "🌍 Location not supplied";
  if (!normalized.countryCode) return `🌍 ${sourceLocation}`;
  return `${normalized.countryFlag} ${sourceLocation}`;
}

/** "Today" / "Yesterday" / "3d ago" / "2w ago" / "4mo ago", or "Unknown" for a bad date. */
export function formatRelativeDate(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "Unknown";
  const days = Math.floor((Date.now() - ms) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

/**
 * Posted-date label for a job card. When the source never gave a real post
 * date, falls back to an approximate age since fetch and says so explicitly.
 */
export function formatPostedLabel(
  job: Pick<RawJob, "date_unknown" | "fetched_at" | "posted_at">,
): string {
  if (job.date_unknown) {
    const days = Math.round((Date.now() - Date.parse(job.fetched_at)) / 86_400_000);
    return `~${days}d ago (date unknown)`;
  }
  return formatRelativeDate(job.posted_at);
}

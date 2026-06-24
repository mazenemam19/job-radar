// src/lib/api-errors.ts
// Shared error-response helper for API route handlers.

import { NextResponse } from "next/server";

/**
 * Logs the real database/error detail server-side and returns a generic
 * message to the client. Use this instead of putting `error.message`
 * straight into the JSON response — raw Supabase errors can leak schema,
 * query, or RLS policy details to callers.
 *
 *   const { data, error } = await db.from("tracker_entries").select("*");
 *   if (error) return dbErrorResponse("tracker:GET", error);
 */
export function dbErrorResponse(context: string, error: { message: string }) {
  console.error(`[${context}]`, error.message);
  return NextResponse.json(
    { ok: false, error: "Something went wrong. Please try again." },
    { status: 500 },
  );
}

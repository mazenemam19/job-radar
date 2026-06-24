// src/lib/api-errors.ts
// Shared error-response helpers for API route handlers.

import { NextResponse } from "next/server";

/**
 * For Supabase query errors: logs the real error server-side and returns a
 * generic message to the client. Prevents raw Supabase messages (which can
 * leak schema, query, or RLS policy details) from reaching callers.
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

/**
 * For caught thrown errors (internal function calls, third-party SDKs, etc.):
 * logs the real message server-side and returns a generic message to the
 * client. Use in catch blocks where the thrown value is `unknown`.
 *
 *   try {
 *     await someInternalCall();
 *   } catch (err) {
 *     return catchErrorResponse("strategy:POST", err);
 *   }
 */
export function catchErrorResponse(context: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[${context}]`, message);
  return NextResponse.json(
    { ok: false, error: "Something went wrong. Please try again." },
    { status: 500 },
  );
}

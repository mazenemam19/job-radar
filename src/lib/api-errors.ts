// src/lib/api-errors.ts
// Shared error-response helpers for API route handlers.

import { NextResponse } from "next/server";

type ApiErrorBody = {
  ok: false;
  /** Stable operation identifier for UI handling and support diagnostics. */
  code: string;
  /** Actionable message suitable for displaying to the caller. */
  error: string;
  /** Raw diagnostic detail is intentionally available only outside production. */
  detail?: string;
};

function normalizeDetail(detail: string): string {
  return detail.replace(/\s+/g, " ").trim().slice(0, 500) || "No diagnostic detail was provided.";
}

function errorBody(context: string, detail: string): ApiErrorBody {
  const normalizedDetail = normalizeDetail(detail);

  if (process.env.NODE_ENV === "production") {
    return {
      ok: false,
      code: context,
      error: `Request failed in ${context}. Please try again.`,
    };
  }

  return {
    ok: false,
    code: context,
    error: `Request failed in ${context}: ${normalizedDetail}`,
    detail: normalizedDetail,
  };
}

/**
 * For Supabase query errors: log the operation and return an actionable
 * response. Development responses include the underlying diagnostic; release
 * responses retain the operation code but avoid exposing DB internals.
 *
 *   const { data, error } = await db.from("tracker_entries").select("*");
 *   if (error) return dbErrorResponse("tracker:GET", error);
 */
export function dbErrorResponse(context: string, error: { message: string }) {
  console.error(`[${context}]`, error.message);
  return NextResponse.json(errorBody(context, error.message), { status: 500 });
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
  return NextResponse.json(errorBody(context, message), { status: 500 });
}

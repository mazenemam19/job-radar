// src/app/api/jobs/route.ts
import { NextResponse } from "next/server";
import { readStore } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const store = await readStore();
  return NextResponse.json(store, {
    headers: {
      "Cache-Control": "no-store, max-age=0, must-revalidate",
    },
  });
}

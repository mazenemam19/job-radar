// src/app/api/jobs/route.ts
import { NextResponse } from "next/server";
import { readStore } from "@/lib/storage";

export const dynamic = "force-dynamic"; // never cache — always fresh from disk

export async function GET() {
  const store = await readStore();
  return NextResponse.json(store);
}

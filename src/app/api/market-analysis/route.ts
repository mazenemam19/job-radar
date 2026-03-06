// src/app/api/market-analysis/route.ts
import { NextResponse } from "next/server";
import { computeMarketAnalysis } from "@/lib/market";

export async function GET() {
  const analysis = await computeMarketAnalysis();

  if (!analysis) {
    return NextResponse.json({ error: "No data available" }, { status: 404 });
  }

  return NextResponse.json(analysis);
}

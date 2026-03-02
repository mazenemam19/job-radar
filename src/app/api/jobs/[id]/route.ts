import { NextResponse } from "next/server";
import { readStore } from "@/lib/storage";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const store = await readStore();
  const job = store.jobs.find((j) => j.id === params.id);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(job);
}

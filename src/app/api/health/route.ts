import { NextResponse } from "next/server";
import { getDatabaseSummary } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await getDatabaseSummary();
    return NextResponse.json({ status: "ok", checkedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "unavailable", checkedAt: new Date().toISOString() }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

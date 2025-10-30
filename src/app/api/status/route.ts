import { NextResponse } from "next/server";

import { generateStatusReport } from "@/lib/status";

export const dynamic = "force-dynamic";

export async function GET() {
  const report = await generateStatusReport();
  return NextResponse.json(report, { status: 200 });
}

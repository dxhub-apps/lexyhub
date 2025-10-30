import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/tokens";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = auth.slice("Bearer ".length);
  const payload = verifyToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // placeholder data
  return NextResponse.json(
    [
      { keyword: "boho wall art", demand_index: 0.86 },
      { keyword: "minimalist print", demand_index: 0.71 }
    ],
    { status: 200 }
  );
}

import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/tokens";

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

  return NextResponse.json(
    {
      apps: [
        { id: "keyword-intel", name: "Keyword Intelligence" },
        { id: "shop-insights", name: "Shop Insights" }
      ]
    },
    { status: 200 }
  );
}

import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/tokens";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth?.valid Supabase token" }, { status: 401 });
  }

  const lexyToken = signToken({ sub: user.id, email: user.email });
  return NextResponse.json({ token: lexyToken }, { status: 200 });
}

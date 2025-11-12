import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";

async function exchangeCode(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });

  if (request.method === "POST") {
    const formData = await request.formData();
    const code = formData.get("code");
    if (typeof code === "string") {
      await supabase.auth.exchangeCodeForSession(code);
    }
    return;
  }

  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  }
}

function resolveRedirect(request: NextRequest): string {
  const requested = request.nextUrl.searchParams.get("redirect_to") ?? "/search";
  return requested.startsWith("/") ? requested : "/search";
}

export async function GET(request: NextRequest) {
  await exchangeCode(request);
  return NextResponse.redirect(new URL(resolveRedirect(request), request.url));
}

export async function POST(request: NextRequest) {
  await exchangeCode(request);
  return NextResponse.redirect(new URL(resolveRedirect(request), request.url));
}

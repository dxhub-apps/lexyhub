// src/app/api/auth/callback/reddit/route.ts
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const REDDIT_CLIENT_ID = process.env.REDDIT_CLIENT_ID!;
const REDDIT_CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET!;
const REDDIT_REDIRECT_URI = process.env.REDDIT_REDIRECT_URI!;

async function exchangeCodeForToken(code: string) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDDIT_REDIRECT_URI,
  }).toString();

  const r = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " + Buffer.from(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`).toString("base64"),
      "User-Agent": "lexyhub/1.0 by lexyhub",
    },
    body,
    cache: "no-store",
  });

  if (!r.ok) throw new Error(`token_exchange_failed:${r.status}`);
  return (await r.json()) as {
    access_token: string;
    token_type: string;
    expires_in: number;
    scope: string;
    refresh_token?: string;
  };
}

async function getIdentity(accessToken: string) {
  const r = await fetch("https://oauth.reddit.com/api/v1/me", {
    headers: {
      Authorization: `bearer ${accessToken}`,
      "User-Agent": "lexyhub/1.0 by lexyhub",
    },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`identity_failed:${r.status}`);
  return (await r.json()) as { id: string; name: string };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = req.cookies.get("reddit_oauth_state")?.value;

  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(new URL("/auth/error?reason=state", req.url));
  }

  // Read authenticated Supabase user from cookies (App Router)
  const supabaseUserClient = createRouteHandlerClient({ cookies });
  const {
    data: { user },
    error: userErr,
  } = await supabaseUserClient.auth.getUser();
  if (userErr || !user?.id) {
    return NextResponse.redirect(new URL("/auth/error?reason=unauthenticated", req.url));
  }

  try {
    const token = await exchangeCodeForToken(code);
    const me = await getIdentity(token.access_token);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();
    const scopes = token.scope ? token.scope.split(" ") : [];

    const { error } = await admin.from("marketplace_accounts").upsert(
      {
        user_id: user.id,
        provider_id: "reddit",
        external_shop_id: me.id,
        shop_name: me.name,
        access_token: token.access_token,
        refresh_token: token.refresh_token ?? null,
        token_expires_at: expiresAt,
        scopes,
        status: "active",
        metadata: {},
      },
      { onConflict: "user_id,provider_id,external_shop_id" }
    );
    if (error) throw error;

    const ok = new URL("/integrations/reddit?connected=1&name=" + encodeURIComponent(me.name), req.url);
    ok.hostname = "app.lexyhub.com";
    ok.protocol = "https:";
    return NextResponse.redirect(ok);
  } catch (e) {
    console.error("reddit_oauth_error", e);
    return NextResponse.redirect(new URL("/auth/error?reason=oauth", req.url));
  }
}

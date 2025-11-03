// src/app/api/auth/callback/reddit/route.ts
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";

const U = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const AK = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const CID = process.env.REDDIT_CLIENT_ID!;
const CS = process.env.REDDIT_CLIENT_SECRET!;
const RURI = process.env.REDDIT_REDIRECT_URI!;

async function tokenExchange(code: string) {
  const body = new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: RURI }).toString();
  const r = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(`${CID}:${CS}`).toString("base64"),
      "User-Agent": "lexyhub/1.0 by lexyhub",
    },
    body,
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`token_exchange:${r.status}:${await r.text()}`);
  return r.json() as Promise<{ access_token: string; expires_in: number; scope: string; refresh_token?: string }>;
}

async function me(token: string) {
  const r = await fetch("https://oauth.reddit.com/api/v1/me", {
    headers: { Authorization: `bearer ${token}`, "User-Agent": "lexyhub/1.0 by lexyhub" },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`me:${r.status}:${await r.text()}`);
  return r.json() as Promise<{ id: string; name: string }>;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = req.cookies.get("reddit_oauth_state")?.value;

  const res = NextResponse.next();

  try {
    if (!code) throw new Error("bad_request:missing_code");
    if (!state || !cookieState || state !== cookieState) throw new Error("state_mismatch");

    const supabaseUser = createServerClient(U, AK, {
      cookies: {
        get: (n) => req.cookies.get(n)?.value,
        set: (n, v, o) => res.cookies.set({ name: n, value: v, ...o }),
        remove: (n, o) => res.cookies.set({ name: n, value: "", ...o, maxAge: 0 }),
      },
    });
    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr) throw new Error("auth_get_user:" + userErr.message);
    if (!user?.id) throw new Error("unauthenticated");

    const tok = await tokenExchange(code);
    const ident = await me(tok.access_token);

    const admin = createClient(U, SR, { auth: { persistSession: false } });
    const expiresAt = new Date(Date.now() + tok.expires_in * 1000).toISOString();
    const scopes = tok.scope ? tok.scope.split(" ") : [];

    const { error: upsertErr } = await admin.from("marketplace_accounts").upsert(
      {
        user_id: user.id,
        provider_id: "reddit",
        external_shop_id: ident.id,
        shop_name: ident.name,
        access_token: tok.access_token,
        refresh_token: tok.refresh_token ?? null,
        token_expires_at: expiresAt,
        scopes, // requires column type text[]
        status: "active",
        metadata: {},
      },
      { onConflict: "user_id,provider_id,external_shop_id" }
    );
    if (upsertErr) throw new Error("db_upsert:" + upsertErr.message);

    const ok = new URL("/integrations/reddit?connected=1&name=" + encodeURIComponent(ident.name), req.url);
    ok.hostname = "app.lexyhub.com";
    ok.protocol = "https:";
    return NextResponse.redirect(ok);
  } catch (e: any) {
    console.error("reddit_oauth_error", e?.message || e);
    const err = new URL("/auth/error", req.url);
    err.searchParams.set("reason", e?.message || "unknown");
    err.hostname = "app.lexyhub.com";
    err.protocol = "https:";
    return NextResponse.redirect(err);
  }
}

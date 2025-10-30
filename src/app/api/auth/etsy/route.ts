import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { buildEtsyAuthorizationUrl, exchangeEtsyCode, fetchEtsyShops, isEtsyConfigured } from "@/lib/etsy/client";
import { ensureEtsyProvider, syncEtsyAccount, upsertMarketplaceAccount } from "@/lib/etsy/sync";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const STATE_COOKIE = "etsy_oauth_state";
const DEFAULT_SCOPES = ["listings_r", "listings_w", "shops_r"] as const;

function requireUserId(req: NextRequest): string {
  const userId = req.nextUrl.searchParams.get("userId") ?? req.headers.get("x-lexy-user-id");
  if (!userId) {
    throw new Error("userId is required to link an Etsy account");
  }
  return userId;
}

function serializeStateCookie(state: string): void {
  const cookieStore = cookies();
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });
}

function readStateCookie(): string | null {
  const cookieStore = cookies();
  const value = cookieStore.get(STATE_COOKIE);
  return value?.value ?? null;
}

function clearStateCookie(): void {
  const cookieStore = cookies();
  cookieStore.delete(STATE_COOKIE);
}

function resolveScopes(request: NextRequest): typeof DEFAULT_SCOPES[number][] {
  const scopes = request.nextUrl.searchParams
    .getAll("scope")
    .filter((scope): scope is typeof DEFAULT_SCOPES[number] =>
      (DEFAULT_SCOPES as readonly string[]).includes(scope),
    );
  if (scopes.length > 0) {
    return scopes;
  }
  return [...DEFAULT_SCOPES];
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = getSupabaseServerClient();

  if (!isEtsyConfigured()) {
    return NextResponse.json(
      {
        authorizationUrl: null,
        status: "disabled",
        message: "Etsy credentials are not configured.",
      },
      { status: 200 },
    );
  }

  const userId = request.nextUrl.searchParams.get("userId");
  const code = request.nextUrl.searchParams.get("code");
  const returnedState = request.nextUrl.searchParams.get("state");

  if (!code) {
    const state = randomUUID();
    serializeStateCookie(state);
    const authorizationUrl = buildEtsyAuthorizationUrl({ state, scopes: resolveScopes(request) });
    return NextResponse.json({ authorizationUrl, status: "ready" });
  }

  try {
    const expectedState = readStateCookie();
    if (expectedState && returnedState && expectedState !== returnedState) {
      return NextResponse.json({ error: "State mismatch detected" }, { status: 400 });
    }
  } finally {
    clearStateCookie();
  }

  if (!userId) {
    return NextResponse.json({ error: "userId query parameter is required" }, { status: 400 });
  }

  try {
    await ensureEtsyProvider(supabase ?? undefined);
    const token = await exchangeEtsyCode(code);
    const scopes = token.scope?.split(" ")?.filter(Boolean) ?? resolveScopes(request);

    const shops = await fetchEtsyShops(token.access_token);
    const primaryShop = shops[0];

    if (!primaryShop) {
      throw new Error("No Etsy shop returned for authorized account");
    }

    const account = await upsertMarketplaceAccount(userId, primaryShop, token, scopes, supabase ?? undefined);
    if (!account) {
      throw new Error("Failed to persist marketplace account");
    }

    const syncResult = await syncEtsyAccount(
      { ...account, access_token: token.access_token, refresh_token: token.refresh_token },
      { incremental: false },
      supabase ?? undefined,
    );

    return NextResponse.json({
      status: "linked",
      account,
      syncResult,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    if (!isEtsyConfigured()) {
      throw new Error("Etsy credentials are not configured");
    }
    const userId = requireUserId(request);
    const payload = await request.json();
    const accessToken = payload?.accessToken as string | undefined;
    const scopes = (payload?.scopes as string[] | undefined) ?? [...DEFAULT_SCOPES];

    if (!accessToken) {
      throw new Error("accessToken is required to link an account");
    }

    const shopList = await fetchEtsyShops(accessToken);
    const primary = shopList[0];
    if (!primary) {
      throw new Error("No Etsy shops returned for provided token");
    }

    const account = await upsertMarketplaceAccount(
      userId,
      primary,
      {
        access_token: accessToken,
        refresh_token: payload.refreshToken ?? accessToken,
        expires_in: payload.expiresIn ?? 3600,
        token_type: "Bearer",
        scope: scopes.join(" "),
      },
      scopes,
    );

    if (!account) {
      throw new Error("Failed to persist marketplace account");
    }

    const supabase = getSupabaseServerClient();
    const result = await syncEtsyAccount(account, { incremental: false }, supabase ?? undefined);

    return NextResponse.json({ status: "linked", account, syncResult: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

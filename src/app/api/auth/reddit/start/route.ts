// src/app/api/auth/reddit/start/route.ts
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import crypto from "crypto";

const CLIENT_ID = process.env.REDDIT_CLIENT_ID!;
const REDIRECT_URI = process.env.REDDIT_REDIRECT_URI!;
const SCOPE = ["identity", "read"].join(" ");
const DURATION = "permanent";

export async function GET() {
  if (!CLIENT_ID || !REDIRECT_URI) {
    // Point to an existing page in your app
    return NextResponse.redirect(new URL("/integrations/reddit?error=env", "https://app.lexyhub.com"));
  }

  const state = crypto.randomBytes(16).toString("hex");
  const authUrl =
    "https://www.reddit.com/api/v1/authorize?" +
    new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: "code",
      state,
      redirect_uri: REDIRECT_URI,
      duration: DURATION,
      scope: SCOPE,
    }).toString();

  const res = NextResponse.redirect(authUrl);
  res.cookies.set("reddit_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 300,
  });
  return res;
}

// src/app/api/auth/reddit/start/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";

const REDIRECT_URI = process.env.REDDIT_REDIRECT_URI!;
const CLIENT_ID = process.env.REDDIT_CLIENT_ID!;
const SCOPE = ["identity", "read"].join(" ");
const DURATION = "permanent"; // or "temporary"

export async function GET() {
  const state = crypto.randomBytes(16).toString("hex");
  const res = NextResponse.redirect(
    `https://www.reddit.com/api/v1/authorize?` +
      new URLSearchParams({
        client_id: CLIENT_ID,
        response_type: "code",
        state,
        redirect_uri: REDIRECT_URI,
        duration: DURATION,
        scope: SCOPE,
      }).toString()
  );
  res.cookies.set("reddit_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 300,
  });
  return res;
}

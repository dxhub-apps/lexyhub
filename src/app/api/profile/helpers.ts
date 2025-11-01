import { NextRequest } from "next/server";

export function requireUserId(request: NextRequest): string {
  const userId = request.nextUrl.searchParams.get("userId") ?? request.headers.get("x-lexy-user-id");
  if (!userId) {
    throw new Error("userId is required");
  }
  return userId;
}

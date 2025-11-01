import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import type { NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";

async function requireUser(request: NextRequest): Promise<User> {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw new Error(error.message);
  }

  if (!user) {
    const providedUserId = request.nextUrl.searchParams.get("userId") ?? request.headers.get("x-lexy-user-id");
    throw new Error(providedUserId ? "Session expired" : "Authentication required");
  }

  return user;
}

export async function requireUserId(request: NextRequest): Promise<string> {
  const user = await requireUser(request);
  return user.id;
}

export async function requireAuthUser(request: NextRequest): Promise<User> {
  return requireUser(request);
}

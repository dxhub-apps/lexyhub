import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import type { User } from "@supabase/supabase-js";

import { fetchUserPlan, isAdminUser } from "@/lib/auth/admin";

export class AdminAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminAccessError";
  }
}

export async function requireAdminUser(): Promise<{ user: User; plan: string | null }> {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw new AdminAccessError(error.message);
  }

  if (!user) {
    throw new AdminAccessError("Authentication required");
  }

  const { plan } = await fetchUserPlan(supabase, user.id);

  if (!isAdminUser(user, plan)) {
    throw new AdminAccessError("Admin access required");
  }

  return { user, plan };
}

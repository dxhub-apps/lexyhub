export function assertAdmin(headers: Headers): void {
  const role = headers.get("x-user-role") ?? headers.get("x-admin") ?? "";
  const isAdmin = role.toLowerCase() === "admin" || role.toLowerCase() === "true";
  if (isAdmin) {
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    return;
  }

  throw new Error("Admin access required");
}

export function isAdmin(headers: Headers): boolean {
  try {
    assertAdmin(headers);
    return true;
  } catch (error) {
    return false;
  }
}

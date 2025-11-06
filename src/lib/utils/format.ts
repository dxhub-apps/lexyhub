/**
 * Masks an email address for privacy
 * Example: john.doe@example.com -> j*******@example.com
 * Example: a@test.com -> a*@test.com
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes("@")) {
    return "***@***.***";
  }

  const [localPart, domain] = email.split("@");

  if (localPart.length === 0) {
    return `***@${domain}`;
  }

  if (localPart.length === 1) {
    return `${localPart}*@${domain}`;
  }

  // Show first character and mask the rest
  const maskedLocal = localPart[0] + "*".repeat(localPart.length - 1);

  return `${maskedLocal}@${domain}`;
}

/**
 * Formats currency from cents
 */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

/**
 * Canonical form for auth identifiers. Most mail systems treat addresses as
 * case-insensitive; storing and matching in this form avoids duplicate accounts
 * and missed lookups when the client changes casing (e.g. Gmail vs gmail).
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

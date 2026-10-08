// Mirrors frontend/utils/phone.ts and backend/xutils/phone.go; salt and rules must stay identical.
const DEFAULT_REGION_CODE = "1";
const CONTACT_HASH_SALT = "kindred-contact-v1";

export function normalizeE164(raw: string): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  const hasPlus = trimmed.startsWith("+");
  let number = trimmed.replace(/\D/g, "");
  if (!number) return null;
  if (hasPlus) {
    // Already carries a country code.
  } else if (number.startsWith("00")) {
    number = number.slice(2);
  } else if (number.length === 10) {
    number = DEFAULT_REGION_CODE + number;
  } else if (!(number.length === 11 && number.startsWith(DEFAULT_REGION_CODE))) {
    return null;
  }
  if (number.length < 8 || number.length > 15) return null;
  return "+" + number;
}

export function looksLikePhone(raw: string): boolean {
  return /^[\d\s()+.-]+$/.test(raw.trim()) && normalizeE164(raw) !== null;
}

export async function hashPhone(raw: string): Promise<string | null> {
  const e164 = normalizeE164(raw);
  if (!e164) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(CONTACT_HASH_SALT + e164));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

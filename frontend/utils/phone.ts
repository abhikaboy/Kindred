import * as Crypto from "expo-crypto";

/**
 * Calling code assumed for numbers that arrive without one. Matches the "+1"
 * default on the onboarding phone screen and DefaultPhoneRegionCode in the Go
 * backend (backend/xutils/phone.go).
 */
const DEFAULT_REGION_CODE = "1";

/**
 * Prepended to a number before hashing. Must stay byte-identical to
 * contactHashSalt() in backend/xutils/phone.go — we hash address-book numbers
 * here and the server hashes the numbers it already stores, and the two only
 * join if the salt matches.
 *
 * This is obfuscation rather than secrecy: the phone keyspace is small enough
 * to brute force. It exists so raw numbers for people who never signed up never
 * leave the device.
 */
const CONTACT_HASH_SALT = "kindred-contact-v1";

/**
 * Converts a loosely formatted phone number into E.164 ("+15551234567"),
 * or returns null when the input can't be read as a phone number.
 *
 * Mirrors NormalizeE164 in backend/xutils/phone.go. If you change the rules
 * here, change them there too, or contact matching will silently stop working.
 */
export function normalizeE164(raw: string): string | null {
    const trimmed = (raw ?? "").trim();
    if (!trimmed) return null;

    const hasPlus = trimmed.startsWith("+");
    let number = trimmed.replace(/\D/g, "");
    if (!number) return null;

    if (hasPlus) {
        // Already carries a country code.
    } else if (number.startsWith("00")) {
        // "00" is the international dialing prefix in much of the world.
        number = number.slice(2);
    } else if (number.length === 10) {
        // Bare national number; assume the default region.
        number = DEFAULT_REGION_CODE + number;
    } else if (number.length === 11 && number.startsWith(DEFAULT_REGION_CODE)) {
        // Already has the default country code, just no "+".
    } else {
        // Too ambiguous to guess at.
        return null;
    }

    if (number.length < 8 || number.length > 15) return null;

    return "+" + number;
}

/**
 * Salted SHA-256 of a phone number, hex encoded, or null if the number can't be
 * normalized. This is what gets uploaded for contact matching — never the raw
 * number.
 */
export async function hashPhone(raw: string): Promise<string | null> {
    const e164 = normalizeE164(raw);
    if (!e164) return null;
    return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, CONTACT_HASH_SALT + e164);
}

/**
 * Hashes many numbers at once, dropping unparseable ones and de-duplicating the
 * result. Returns the hashes alongside a hash -> E.164 map so the caller can
 * still label matches with the contact's name without the raw numbers ever
 * being sent to the server.
 */
export async function hashPhones(raws: string[]): Promise<{ hashes: string[]; byHash: Record<string, string> }> {
    const byHash: Record<string, string> = {};

    for (const raw of raws) {
        const e164 = normalizeE164(raw);
        if (!e164) continue;
        const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, CONTACT_HASH_SALT + e164);
        byHash[hash] = e164;
    }

    return { hashes: Object.keys(byHash), byHash };
}

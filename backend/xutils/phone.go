package xutils

import (
	"crypto/sha256"
	"encoding/hex"
	"os"
	"strings"
)

// DefaultPhoneRegionCode is the calling code assumed for numbers that arrive
// without one. The client defaults to "+1" on the onboarding screen, so we
// match that here rather than silently dropping numbers typed as "5551234567".
const DefaultPhoneRegionCode = "1"

// contactHashSalt is prepended to a number before hashing. It must stay in sync
// with the value the mobile client uses (frontend/utils/phone.ts), because the
// client hashes address-book numbers locally and the server hashes the numbers
// it already stores; the two only join if the salt matches.
//
// Note this is obfuscation, not secrecy: the phone number keyspace is small
// enough to brute force if both the salt and the database leak. It exists so we
// never persist raw numbers for people who have not signed up.
func contactHashSalt() string {
	if s := os.Getenv("CONTACT_HASH_SALT"); s != "" {
		return s
	}
	return "kindred-contact-v1"
}

// NormalizeE164 converts a loosely formatted phone number into E.164
// ("+15551234567"). It returns an empty string when the input cannot be
// interpreted as a phone number, so callers can treat "" as "no match possible"
// rather than storing junk.
//
// This deliberately handles the common cases (US 10-digit, US 11-digit with a
// leading 1, an explicit "+" prefix, and the "00" international prefix) instead
// of pulling in a full libphonenumber port. Numbers that already carry a "+"
// are passed through with only their separators stripped, so international
// contacts still match as long as the address book stores them canonically.
func NormalizeE164(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ""
	}

	hasPlus := strings.HasPrefix(trimmed, "+")

	var digits strings.Builder
	for _, r := range trimmed {
		if r >= '0' && r <= '9' {
			digits.WriteRune(r)
		}
	}
	number := digits.String()
	if number == "" {
		return ""
	}

	switch {
	case hasPlus:
		// Already carries a country code.
	case strings.HasPrefix(number, "00"):
		// "00" is the international dialing prefix in much of the world.
		number = strings.TrimPrefix(number, "00")
	case len(number) == 10:
		// Bare national number; assume the default region.
		number = DefaultPhoneRegionCode + number
	case len(number) == 11 && strings.HasPrefix(number, DefaultPhoneRegionCode):
		// Already has the default country code, just no "+".
	default:
		// Anything else is too ambiguous to guess at.
		return ""
	}

	// E.164 allows at most 15 digits, and a country code plus subscriber number
	// is never shorter than 8 in practice.
	if len(number) < 8 || len(number) > 15 {
		return ""
	}

	return "+" + number
}

// HashPhone returns the salted SHA-256 of an E.164 number, hex encoded. It
// normalizes first so callers can pass raw input safely. An unparseable number
// hashes to "" so it never collides with a real one.
func HashPhone(raw string) string {
	e164 := NormalizeE164(raw)
	if e164 == "" {
		return ""
	}
	return HashNormalizedPhone(e164)
}

// HashNormalizedPhone hashes a number that is already known to be E.164.
func HashNormalizedPhone(e164 string) string {
	sum := sha256.Sum256([]byte(contactHashSalt() + e164))
	return hex.EncodeToString(sum[:])
}

package oauth

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"net"
	"strings"
	"sync"
	"time"
)

func randomString(n int) (string, error) {
	buf := make([]byte, n)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("generate random: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

func newSecret(prefix string) (string, error) {
	r, err := randomString(secretBytes)
	if err != nil {
		return "", err
	}
	return prefix + r, nil
}

var encodedSecretLen = base64.RawURLEncoding.EncodedLen(secretBytes)

func secretWellFormed(raw, prefix string) bool {
	return strings.HasPrefix(raw, prefix) && len(raw) == len(prefix)+encodedSecretLen
}

func hashSecret(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

func constantTimeEqual(a, b string) bool {
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}

// userCodeAlphabet is Crockford-style base32: no I, L, O or U.
const userCodeAlphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

func newUserCode() (string, error) {
	buf := make([]byte, 8)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("generate user code: %w", err)
	}
	out := make([]byte, 8)
	for i, b := range buf {
		out[i] = userCodeAlphabet[int(b)%len(userCodeAlphabet)]
	}
	return string(out), nil
}

// normalizeUserCode uppercases, drops separators and maps look-alike characters.
func normalizeUserCode(raw string) string {
	var b strings.Builder
	for _, r := range strings.ToUpper(raw) {
		switch r {
		case '-', ' ', '_':
			continue
		case 'O':
			r = '0'
		case 'I', 'L':
			r = '1'
		}
		if !strings.ContainsRune(userCodeAlphabet, r) {
			return ""
		}
		b.WriteRune(r)
	}
	if b.Len() != 8 {
		return ""
	}
	return b.String()
}

func formatUserCode(code string) string {
	if len(code) != 8 {
		return code
	}
	return code[:4] + "-" + code[4:]
}

func requestIDWellFormed(id string) bool {
	if len(id) != 22 {
		return false
	}
	for _, r := range id {
		if !(r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' || r == '-' || r == '_') {
			return false
		}
	}
	return true
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}

// clientIP mirrors auth.clientIPFromRequest: proxy headers first, then the socket.
func clientIP(header func(string) string, remoteAddr string) string {
	if ip := strings.TrimSpace(header("CF-Connecting-IP")); ip != "" {
		return truncate(ip, 64)
	}
	if ip := strings.TrimSpace(header("X-Real-IP")); ip != "" {
		return truncate(ip, 64)
	}
	if xff := header("X-Forwarded-For"); xff != "" {
		if first := strings.TrimSpace(strings.Split(xff, ",")[0]); first != "" {
			return truncate(first, 64)
		}
	}
	if host, _, err := net.SplitHostPort(remoteAddr); err == nil {
		return host
	}
	return remoteAddr
}

// rateLimiter is a fixed-window, per-process counter keyed by caller.
type rateLimiter struct {
	mu      sync.Mutex
	entries map[string]*rateEntry
	max     int
	window  time.Duration
	now     func() time.Time
}

type rateEntry struct {
	count int
	start time.Time
}

const rateLimiterPruneSize = 10000

func newRateLimiter(max int, window time.Duration) *rateLimiter {
	return &rateLimiter{entries: map[string]*rateEntry{}, max: max, window: window, now: time.Now}
}

func (rl *rateLimiter) Allow(key string) bool {
	if rl == nil {
		return true
	}
	rl.mu.Lock()
	defer rl.mu.Unlock()
	now := rl.now()
	if len(rl.entries) >= rateLimiterPruneSize {
		for k, e := range rl.entries {
			if now.Sub(e.start) > rl.window {
				delete(rl.entries, k)
			}
		}
	}
	e, ok := rl.entries[key]
	if !ok || now.Sub(e.start) > rl.window {
		rl.entries[strings.Clone(key)] = &rateEntry{count: 1, start: now}
		return rl.max > 0
	}
	if e.count >= rl.max {
		return false
	}
	e.count++
	return true
}

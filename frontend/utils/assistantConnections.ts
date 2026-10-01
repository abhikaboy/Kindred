// Pure helpers for the assistant connection (MCP OAuth) screens.

export const REQUIRED_SCOPE = "kindred:read";
export const MCP_CONNECTOR_URL = "https://kindredtodo.com/api/v1/mcp";

const CODE_LENGTH = 8;

/** Formats typed input as XXXX-XXXX: uppercase, letters and digits only, dash after four. */
export function formatConnectionCode(input: string): string {
    const raw = input
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, CODE_LENGTH);
    return raw.length > 4 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : raw;
}

/** Canonical XXXX-XXXX code, or null until the input holds exactly eight characters. */
export function parseConnectionCode(input: string): string | null {
    const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (raw.length !== CODE_LENGTH) return null;
    return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

/** Short, human description of a user agent, e.g. "Chrome on macOS". */
export function summarizeUserAgent(userAgent: string | null | undefined): string {
    const ua = (userAgent ?? "").trim();
    if (!ua) return "Unknown browser";

    const os = detectOS(ua);
    const browser = detectBrowser(ua);
    if (browser && os) return `${browser} on ${os}`;
    if (browser) return browser;
    if (os) return `A browser on ${os}`;
    return "Unknown browser";
}

function detectBrowser(ua: string): string | null {
    if (/Electron\//.test(ua)) return "Desktop app";
    if (/EdgA?\/|EdgiOS\//.test(ua)) return "Edge";
    if (/OPR\/|Opera/.test(ua)) return "Opera";
    if (/SamsungBrowser\//.test(ua)) return "Samsung Internet";
    if (/Firefox\/|FxiOS\//.test(ua)) return "Firefox";
    if (/Chrome\/|CriOS\/|Chromium\//.test(ua)) return "Chrome";
    if (/Safari\//.test(ua) && /Version\//.test(ua)) return "Safari";
    if (/^curl\//i.test(ua)) return "curl";
    return null;
}

function detectOS(ua: string): string | null {
    if (/iPad/.test(ua)) return "iPadOS";
    if (/iPhone|iPod/.test(ua)) return "iOS";
    if (/Android/.test(ua)) return "Android";
    if (/CrOS/.test(ua)) return "ChromeOS";
    if (/Mac OS X|Macintosh/.test(ua)) return "macOS";
    if (/Windows/.test(ua)) return "Windows";
    if (/Linux/.test(ua)) return "Linux";
    return null;
}

/** "just now", "5 minutes ago", "3 hours ago", "2 days ago", else a short date. */
export function timeAgo(iso: string | null | undefined, now: Date = new Date()): string | null {
    if (!iso) return null;
    const then = new Date(iso);
    if (isNaN(then.getTime())) return null;
    const minutes = Math.floor((now.getTime() - then.getTime()) / 60_000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return minutes === 1 ? "a minute ago" : `${minutes} minutes ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours === 1 ? "an hour ago" : `${hours} hours ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return days === 1 ? "yesterday" : `${days} days ago`;
    const sameYear = then.getFullYear() === now.getFullYear();
    return then.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        ...(sameYear ? {} : { year: "numeric" }),
    });
}

export function lastUsedLabel(iso: string | null | undefined, now: Date = new Date()): string {
    const ago = timeAgo(iso, now);
    return ago ? `Used ${ago}` : "Not used yet";
}

type ScopeLike = { id: string; title?: string } | string;

const SCOPE_WORDS: Record<string, string> = {
    "kindred:read": "Read",
    "kindred:write": "Edit",
    "kindred:complete": "Complete",
};

/** Compact scope summary for list rows, e.g. "Read, edit, complete". */
export function scopeSummary(scopes: ScopeLike[] | null | undefined): string | null {
    if (!scopes || scopes.length === 0) return null;
    const words = scopes.map((s) => {
        const id = typeof s === "string" ? s : s.id;
        return SCOPE_WORDS[id] ?? (typeof s === "string" ? s : (s.title ?? s.id));
    });
    return words.map((w, i) => (i === 0 ? w : w.toLowerCase())).join(", ");
}

/** Scopes to send on approve: whatever is switched on, with read always included. */
export function scopesToApprove(requested: { id: string }[], enabled: Record<string, boolean>): string[] {
    return requested.map((s) => s.id).filter((id) => id === REQUIRED_SCOPE || enabled[id] !== false);
}

export function isExpired(expiresAt: string | null | undefined, now: Date = new Date()): boolean {
    if (!expiresAt) return false;
    const t = new Date(expiresAt).getTime();
    return !isNaN(t) && t <= now.getTime();
}

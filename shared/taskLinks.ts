/**
 * Task links — URLs attached to a task, either typed into the notes or added
 * explicitly by the user.
 *
 * The backend owns the canonical sync (see backend/internal/handlers/task/links.go);
 * this module mirrors that logic so the clients can show the links a note will
 * produce without waiting for a round trip. Keep the two in step.
 */

export type TaskLinkSource = "notes" | "manual";

export interface TaskLink {
    url: string;
    title?: string;
    source?: TaskLinkSource;
}

/**
 * Matches bare http(s) URLs and www-prefixed hosts. Brackets and quotes are
 * excluded so a URL inside prose or markdown doesn't swallow its surroundings.
 */
const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>()[\]{}"']+/gi;

/** Notes are prose, so "see https://example.com." shouldn't keep the period. */
const TRAILING_PUNCTUATION = /[.,;:!?'"]+$/;

/** Host and scheme are case-insensitive; the rest of the URL is not. */
function normalizeKey(url: string): string | null {
    try {
        const parsed = new URL(url);
        if (!parsed.host) return null;
        return `${parsed.protocol.toLowerCase()}//${parsed.host.toLowerCase()}${parsed.pathname}${parsed.search}${parsed.hash}`.replace(
            /\/$/,
            ""
        );
    } catch {
        return null;
    }
}

function hostLabel(url: string): string {
    try {
        return new URL(url).host.toLowerCase().replace(/^www\./, "");
    } catch {
        return url;
    }
}

/** Pulls every URL out of a notes body, in order, deduplicated. */
export function extractLinksFromNotes(notes: string): TaskLink[] {
    const links: TaskLink[] = [];
    const seen = new Set<string>();

    for (const match of notes.match(URL_PATTERN) ?? []) {
        let raw = match.replace(TRAILING_PUNCTUATION, "");
        // An unbalanced ")" is far more likely to be prose than part of the URL.
        if ((raw.match(/\(/g)?.length ?? 0) < (raw.match(/\)/g)?.length ?? 0)) {
            raw = raw.replace(/\)+$/, "");
        }
        if (!raw) continue;
        if (!raw.includes("://")) raw = `https://${raw}`;

        const key = normalizeKey(raw);
        if (!key || seen.has(key)) continue;
        seen.add(key);

        links.push({ url: raw, title: hostLabel(raw), source: "notes" });
    }

    return links;
}

/**
 * Returns the link list for a task whose notes just changed: manually attached
 * links are kept as-is, and notes-derived links are replaced wholesale by what
 * the new notes contain. A URL already attached manually wins, so re-typing it
 * in the notes doesn't produce a duplicate row.
 */
export function syncNotesLinks(existing: TaskLink[] | null | undefined, notes: string): TaskLink[] {
    const manual = (existing ?? []).filter((link) => link.source !== "notes");
    const manualKeys = new Set(manual.map((link) => normalizeKey(link.url)).filter((key): key is string => key !== null));

    return [...manual, ...extractLinksFromNotes(notes).filter((link) => !manualKeys.has(normalizeKey(link.url) ?? ""))];
}

/**
 * Cleans a user-entered link before it is sent: a missing scheme becomes https,
 * an empty title falls back to the host, and the source defaults to manual so
 * the notes sync won't later remove it. Returns null if there's no usable URL.
 */
export function normalizeLink(url: string, title?: string): TaskLink | null {
    const raw = url.trim();
    if (!raw) return null;
    const withScheme = raw.includes("://") ? raw : `https://${raw}`;
    if (!normalizeKey(withScheme)) return null;

    return {
        url: withScheme,
        title: title?.trim() || hostLabel(withScheme),
        source: "manual",
    };
}

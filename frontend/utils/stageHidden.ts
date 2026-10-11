// Pure rules for "hide this task for 8 hours" on the home stack. A map of task id -> ISO time it comes back.

export const HIDE_MS = 8 * 60 * 60 * 1000;
export const HIDE_HOURS = 8;

export type HiddenMap = Record<string, string>;

const until = (iso: string) => new Date(iso).getTime();

/** Drops entries that have already come back (and anything unreadable). */
export function pruneExpired(map: HiddenMap, now: number): HiddenMap {
    const out: HiddenMap = {};
    for (const [id, iso] of Object.entries(map)) {
        const t = until(iso);
        if (Number.isFinite(t) && t > now) out[id] = iso;
    }
    return out;
}

export const hideTask = (map: HiddenMap, id: string, now: number): HiddenMap => ({
    ...pruneExpired(map, now),
    [id]: new Date(now + HIDE_MS).toISOString(),
});

export function showTask(map: HiddenMap, id: string): HiddenMap {
    const { [id]: _removed, ...rest } = map;
    return rest;
}

export const isHidden = (map: HiddenMap, id: string, now: number): boolean => {
    const iso = map[id];
    return !!iso && until(iso) > now;
};

/** Whole hours until it returns, never below 1 so the label never says "0h". */
export const hoursLeft = (iso: string, now: number): number => Math.max(1, Math.ceil((until(iso) - now) / 3_600_000));

/** The soonest return among the hidden tasks, or null when none are hidden. */
export function nextReturnAt(map: HiddenMap, now: number): number | null {
    const times = Object.values(pruneExpired(map, now)).map(until);
    return times.length ? Math.min(...times) : null;
}

export function parseHiddenMap(raw: string | null, now: number): HiddenMap {
    if (!raw) return {};
    try {
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
        const clean: HiddenMap = {};
        for (const [id, iso] of Object.entries(parsed as Record<string, unknown>)) if (typeof iso === "string") clean[id] = iso;
        return pruneExpired(clean, now);
    } catch {
        return {};
    }
}

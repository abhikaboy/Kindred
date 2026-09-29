import AsyncStorage from "@react-native-async-storage/async-storage";

// Remembers when the app was last opened, so a return after a gap can be met with a
// gentle welcome instead of a pile. Each gap is offered once: the gap is keyed by the
// open that preceded it, and handling it (any choice, or a dismiss) records that key.

const LAST_OPEN_KEY = "kindred:lastOpenAt";
const HANDLED_KEY = "kindred:returnGapHandled";
const DAY_MS = 86400_000;

export type ReturnGap = { key: string; days: number };

let pending: ReturnGap | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Whole days between two opens. */
export function gapDays(previous: number | null | undefined, now: number): number {
    if (!previous || !Number.isFinite(previous) || previous > now) return 0;
    return Math.floor((now - previous) / DAY_MS);
}

/** The gap since the last open, or null when under `minDays` or already handled. */
export function pendingGap(
    previous: number | null | undefined,
    now: number,
    handledKey: string | null,
    minDays = 1
): ReturnGap | null {
    const days = gapDays(previous, now);
    if (days < Math.max(1, minDays)) return null;
    const key = String(previous);
    return key === handledKey ? null : { key, days };
}

/** Call on app foreground: works out any fresh gap, then stamps this open. */
export async function recordAppOpen(now: number = Date.now()): Promise<void> {
    try {
        const [raw, handled] = await Promise.all([
            AsyncStorage.getItem(LAST_OPEN_KEY),
            AsyncStorage.getItem(HANDLED_KEY),
        ]);
        const gap = pendingGap(raw ? Number(raw) : null, now, handled);
        // A short hop between opens keeps the bigger unhandled gap for this session;
        // the welcome threshold itself lives in useReturnGap
        if (gap && gap.days >= (pending?.days ?? 0)) pending = gap;
        await AsyncStorage.setItem(LAST_OPEN_KEY, String(now));
    } catch {
        // Storage trouble just means no welcome
    }
    emit();
}

export const getPendingGap = () => pending;

/** Any choice or a dismiss counts: the same gap never asks twice. */
export function markGapHandled() {
    const gap = pending;
    pending = null;
    emit();
    if (gap) AsyncStorage.setItem(HANDLED_KEY, gap.key).catch(() => {});
}

export function subscribeLastOpen(l: () => void) {
    listeners.add(l);
    return () => {
        listeners.delete(l);
    };
}

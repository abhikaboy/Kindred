import AsyncStorage from "@react-native-async-storage/async-storage";
import type { components } from "@/api/generated/types";

type FriendActivity = components["schemas"]["FriendActivity"];
type TaskDocument = components["schemas"]["TaskDocument"];
type Friend = components["schemas"]["UserExtendedReference"];

// After a completion, occasionally offer to nudge a friend on one of their open tasks.
// "Show this less often" steps the level up: lower odds, longer cooldown.

const STORAGE_KEY = "post_completion_nudge";
export const NUDGE_DEBOUNCE_MS = 6000;
export const MAX_NUDGE_LEVEL = 3;
const CHANCE_BY_LEVEL = [0.35, 0.18, 0.08, 0.03];
const COOLDOWN_HOURS_BY_LEVEL = [3, 12, 48, 120];

export type NudgePromptState = { level: number; lastShownAt?: string; lastFriendId?: string };

export type NudgeCandidate = { friend: Friend; task: TaskDocument };

export type NudgeCopy = { title: string; body: string; cta: string; message: string };

export function shouldPrompt(state: NudgePromptState, now: Date, roll: number): boolean {
    const level = Math.min(Math.max(state.level, 0), MAX_NUDGE_LEVEL);
    if (state.lastShownAt) {
        const elapsed = now.getTime() - new Date(state.lastShownAt).getTime();
        if (elapsed < COOLDOWN_HOURS_BY_LEVEL[level] * 3600000) return false;
    }
    return roll < CHANCE_BY_LEVEL[level];
}

/** Prefers friends actively working on something; skips tasks you already encouraged and the last friend shown. */
export function pickCandidate(
    friends: Friend[],
    activity: FriendActivity[],
    lastFriendId: string | undefined,
    roll: number,
    selfId?: string
): NudgeCandidate | null {
    const byId = new Map(activity.map((a) => [a.user_id, a]));
    const options: (NudgeCandidate & { working: boolean })[] = [];
    for (const friend of friends) {
        const open = (byId.get(friend._id)?.tasks ?? []).filter(
            (t) => t.content?.trim() && !t.encouragements?.some((e) => e.sender?.id === selfId)
        );
        if (!open.length) continue;
        const working = open.find((t) => t.startedAt);
        options.push({ friend, task: working ?? open[0], working: !!working });
    }
    const fresh = options.filter((o) => o.friend._id !== lastFriendId);
    const pool = fresh.length ? fresh : options;
    const working = pool.filter((o) => o.working);
    const finalPool = working.length ? working : pool;
    if (!finalPool.length) return null;
    const { friend, task } = finalPool[Math.min(Math.floor(roll * finalPool.length), finalPool.length - 1)];
    return { friend, task };
}

export function nudgeCopy(name: string, task: string, variant: number): NudgeCopy {
    const variants: NudgeCopy[] = [
        { title: `Give ${name} a nudge?`, body: `"${task}" is still on their list.`, cta: `Nudge ${name}`, message: `You've got this! Go knock out ${task}.` },
        { title: `Cheer on ${name}?`, body: `They've got "${task}" ahead of them.`, cta: "Send a cheer", message: `Cheering you on for ${task}!` },
        { title: `Pass the momentum to ${name}?`, body: `You just finished one. "${task}" is next for them.`, cta: "Pass it on", message: `Just finished one of mine. Your turn: ${task}!` },
        { title: `${name} could use a boost`, body: `"${task}" is waiting on them.`, cta: "Send a boost", message: `Sending a boost your way for ${task}.` },
        { title: `Back ${name} up?`, body: `A quick nudge on "${task}" goes a long way.`, cta: "Nudge them", message: `Rooting for you on ${task}. You can do it!` },
    ];
    return variants[Math.abs(variant) % variants.length];
}

export async function loadNudgeState(): Promise<NudgePromptState> {
    try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        return parsed && typeof parsed.level === "number" ? parsed : { level: 0 };
    } catch {
        return { level: 0 };
    }
}

export async function saveNudgeState(state: NudgePromptState): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
}

export async function markNudgeShown(friendId: string, now: Date = new Date()): Promise<void> {
    const state = await loadNudgeState();
    await saveNudgeState({ ...state, lastShownAt: now.toISOString(), lastFriendId: friendId });
}

export async function showNudgeLessOften(): Promise<void> {
    const state = await loadNudgeState();
    await saveNudgeState({ ...state, level: Math.min(state.level + 1, MAX_NUDGE_LEVEL) });
}

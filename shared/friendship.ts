// Friendship levels. Single source of truth for both frontends.
// Point values MUST stay in sync with backend/internal/friendship/friendship.go.

export type FriendshipLevel = {
    /** 1-based level number. */
    level: number;
    name: string;
    /** Score at which this level starts. */
    floor: number;
    /** Score at which the next level starts, or null at max level. */
    next: number | null;
};

const LEVELS: { name: string; floor: number }[] = [
    { name: "Acquainted", floor: 0 },
    { name: "Friends", floor: 25 },
    { name: "Good friends", floor: 75 },
    { name: "Close friends", floor: 150 },
    { name: "Kindred spirits", floor: 300 },
];

export const MAX_FRIENDSHIP_LEVEL = LEVELS.length;

export function friendshipLevel(score: number): FriendshipLevel {
    const s = Math.max(0, Math.floor(score || 0));
    let i = 0;
    while (i + 1 < LEVELS.length && s >= LEVELS[i + 1].floor) i++;
    return {
        level: i + 1,
        name: LEVELS[i].name,
        floor: LEVELS[i].floor,
        next: i + 1 < LEVELS.length ? LEVELS[i + 1].floor : null,
    };
}

/** Progress through the current level, 0..1. Returns 1 at max level. */
export function friendshipProgress(score: number): number {
    const lvl = friendshipLevel(score);
    if (lvl.next === null) return 1;
    const span = lvl.next - lvl.floor;
    return Math.min(1, Math.max(0, (Math.max(0, score) - lvl.floor) / span));
}

/** Copy for the "how to grow this" sheet. Points match the backend. */
export const FRIENDSHIP_ACTIONS: { label: string; points: number }[] = [
    { label: "Send them kudos", points: 3 },
    { label: "Comment on their post", points: 2 },
    { label: "React to their post or kudos", points: 1 },
];

/** Short bump label for confirmation feedback, e.g. "+3 with Sarah". */
export function friendshipBumpLabel(delta: number, name?: string): string {
    const d = `+${Math.max(0, delta)}`;
    return name ? `${d} with ${name}` : d;
}

// One color per ring, shared by mobile and desktop so they can't drift.
export const RING_COLORS = {
    plan: "#854DFF",
    do: "#2F9BFF",
    share: "#FF6EC7",
} as const;

export type RingKey = keyof typeof RING_COLORS;

export const ringColor = (key: string): string =>
    RING_COLORS[key as RingKey] ?? RING_COLORS.plan;

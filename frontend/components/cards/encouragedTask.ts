import type { Task } from "@/api/types";

// A task is "encouraged" once it carries at least one recorded encouragement.
export const isTaskEncouraged = (task?: Task | null): boolean =>
    (task?.encouragements?.length ?? 0) > 0;

// Color overrides for the encouraged task-card state: a faint primary tint
// fill with a solid primary border, purple text (never gray — too low
// contrast on the light fill), and a soft static glow. `primary` is
// ThemedColor.primary (a 6-digit hex, e.g. "#854DFF"); the 2-hex-digit
// suffix on `background` is the fill alpha.
export const encouragedCardColors = (primary: string) => ({
    background: `${primary}04`,
    border: primary,
    text: primary,
    secondaryText: primary,
    glow: {
        shadowColor: primary,
        shadowOpacity: 0.3,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 3 },
        elevation: 5,
    },
});

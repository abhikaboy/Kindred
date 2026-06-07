import type { Task } from "@/api/types";

// A task is "encouraged" once it carries at least one recorded encouragement.
export const isTaskEncouraged = (task?: Task | null): boolean =>
    (task?.encouragements?.length ?? 0) > 0;

// Color overrides for the encouraged task-card state: a light 30% primary
// fill with a solid primary border, purple text (never gray — too low
// contrast on the light fill), and a soft static glow. `primary` is
// ThemedColor.primary (a 6-digit hex, e.g. "#854DFF"); "4D" ≈ 30% alpha.
export const encouragedCardColors = (primary: string) => ({
    background: `${primary}4D`,
    border: primary,
    text: primary,
    secondaryText: primary,
    glow: {
        shadowColor: primary,
        shadowOpacity: 0.25,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 0 },
        elevation: 4,
    },
});

import type { Task } from "@/api/types";

// A task is "encouraged" once it carries at least one recorded encouragement.
export const isTaskEncouraged = (task?: Task | null): boolean =>
    (task?.encouragements?.length ?? 0) > 0;

// Color overrides for the encouraged task-card state: solid primary fill,
// white text, and a soft static glow. `primary` is ThemedColor.primary.
export const encouragedCardColors = (primary: string) => ({
    background: primary,
    text: "#FFFFFF",
    secondaryText: "rgba(255,255,255,0.8)",
    glow: {
        shadowColor: primary,
        shadowOpacity: 0.45,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 0 },
        elevation: 8,
    },
});

// Shared color + label helpers for the analytics widgets. Keeps the dark-mode
// purple scale and status palette in one place.

export type ThemedColors = Record<string, string>;

// Heatmap intensity 0-4 mapped onto the Kindred purple, empty cells use the
// card-elevated surface so they read as "no activity".
export function heatmapLevelColor(level: number, ThemedColor: ThemedColors): string {
    const primary = ThemedColor.primary ?? "#854DFF";
    switch (level) {
        case 1:
            return primary + "33";
        case 2:
            return primary + "66";
        case 3:
            return primary + "99";
        case 4:
            return primary;
        default:
            return ThemedColor.lightened ?? "#171626";
    }
}

// Status pill color. Avoids gray on light-purple by keeping grays on card bg.
export function statusColor(status: string, ThemedColor: ThemedColors): string {
    switch (status) {
        case "healthy":
            return ThemedColor.success ?? "#22C55E";
        case "steady":
            return ThemedColor.primary ?? "#854DFF";
        case "needs-attention":
        case "needs-reset":
            return ThemedColor.warning ?? "#F59E0B";
        case "slipping":
            return ThemedColor.error ?? "#FF5C5F";
        default: // unsupported | light
            return ThemedColor.caption ?? "#919090";
    }
}

export function statusLabel(status: string): string {
    switch (status) {
        case "healthy":
            return "Healthy";
        case "steady":
            return "Steady";
        case "needs-attention":
            return "Needs attention";
        case "needs-reset":
            return "Needs a reset";
        case "slipping":
            return "Slipping";
        case "unsupported":
            return "Unsupported";
        default:
            return "Light";
    }
}

export function directionColor(direction: string, ThemedColor: ThemedColors): string {
    switch (direction) {
        case "up":
            return ThemedColor.success ?? "#22C55E";
        case "down":
            return ThemedColor.error ?? "#FF5C5F";
        default:
            return ThemedColor.caption ?? "#919090";
    }
}

// Shared status → color mapping for the Activity dashboard widgets. Mirrors the
// mobile app's analyticsColors.ts, translated to Tailwind classes.

const STATUS_TEXT: Record<string, string> = {
  healthy: "text-emerald-500",
  steady: "text-primary",
  "needs-attention": "text-amber-500",
  "needs-reset": "text-amber-500",
  slipping: "text-destructive",
};

const STATUS_LABEL: Record<string, string> = {
  healthy: "Healthy",
  steady: "Steady",
  "needs-attention": "Needs attention",
  "needs-reset": "Needs a reset",
  slipping: "Slipping",
  unsupported: "Unsupported",
  light: "Light",
};

export function statusTextClass(status: string): string {
  return STATUS_TEXT[status] ?? "text-muted-foreground";
}

export function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

export function directionClass(direction: string): string {
  if (direction === "up") return "text-emerald-500";
  // Dips stay neutral: a slower week is information, not an alarm.
  if (direction === "down") return "text-muted-foreground";
  return "text-muted-foreground";
}

// Shared status → color mapping for the Activity dashboard widgets. Mirrors the
// mobile app's analyticsColors.ts, translated to Tailwind classes.

const STATUS_TEXT: Record<string, string> = {
  healthy: "text-emerald-500",
  steady: "text-primary",
  "needs-attention": "text-amber-500",
  "needs-reset": "text-amber-500",
  slipping: "text-destructive",
};

const STATUS_PILL: Record<string, string> = {
  healthy: "bg-emerald-500/10 border-emerald-500/30",
  steady: "bg-primary/10 border-primary/30",
  "needs-attention": "bg-amber-500/10 border-amber-500/30",
  "needs-reset": "bg-amber-500/10 border-amber-500/30",
  slipping: "bg-destructive/10 border-destructive/30",
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

export function statusPillClass(status: string): string {
  return STATUS_PILL[status] ?? "bg-muted border-border";
}

export function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

export function directionClass(direction: string): string {
  if (direction === "up") return "text-emerald-500";
  if (direction === "down") return "text-destructive";
  return "text-muted-foreground";
}

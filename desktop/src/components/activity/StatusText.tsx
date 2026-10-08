import { cn } from "@/lib/utils";
import { statusLabel, statusTextClass } from "./status";

// Status as quiet inline text (" · Slipping"), never a loud badge.
export function StatusText({ status }: { status: string }) {
  return <span className={cn("whitespace-nowrap", statusTextClass(status))}> · {statusLabel(status)}</span>;
}

import { cn } from "@/lib/utils";
import { statusLabel, statusPillClass, statusTextClass } from "./status";

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium",
        statusPillClass(status),
        statusTextClass(status)
      )}
    >
      {statusLabel(status)}
    </span>
  );
}

import { useState } from "react";
import { Flag } from "@phosphor-icons/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PropertyPill } from "@/components/create/PropertyPill";
import { cn } from "@/lib/utils";

// 0 none, 1 low, 2 med, 3 high — 1/2/3 colored green/amber/red (mirrors TaskItem).
const PRIORITIES = [
  { value: 0, label: "No priority", dot: "" },
  { value: 1, label: "Low", dot: "bg-emerald-500" },
  { value: 2, label: "Medium", dot: "bg-amber-500" },
  { value: 3, label: "High", dot: "bg-destructive" },
];

export function PriorityPopover({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = PRIORITIES.find((p) => p.value === value) ?? PRIORITIES[0];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <PropertyPill
            active={value > 0}
            icon={
              active.dot ? (
                <span className={cn("size-2 rounded-full", active.dot)} />
              ) : (
                <Flag size={14} />
              )
            }
          />
        }
      >
        {value > 0 ? active.label : "Priority"}
      </PopoverTrigger>
      <PopoverContent className="w-44 p-1">
        {PRIORITIES.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => {
              onChange(p.value);
              setOpen(false);
            }}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted",
              p.value === value && "bg-muted",
            )}
          >
            {p.dot ? (
              <span className={cn("size-2 rounded-full", p.dot)} />
            ) : (
              <Flag size={14} className="text-muted-foreground" />
            )}
            {p.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

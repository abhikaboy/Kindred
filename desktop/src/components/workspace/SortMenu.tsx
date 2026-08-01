import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CalendarBlank,
  CalendarCheck,
  ChartBar,
  Hash,
  SortAscending,
} from "@phosphor-icons/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PropertyPill } from "@/components/create/PropertyPill";
import { cn } from "@/lib/utils";
import type { SortOption } from "@/lib/categorySort";
import type { SortState } from "@/hooks/useWorkspaceState";

const OPTIONS: { option: SortOption; label: string; icon: typeof Hash }[] = [
  { option: "task-count", label: "Task Count", icon: Hash },
  { option: "alphabetical", label: "Alphabetical", icon: SortAscending },
  { option: "due-date", label: "Due Date", icon: CalendarCheck },
  { option: "start-date", label: "Start Date", icon: CalendarBlank },
  { option: "priority", label: "Priority", icon: ChartBar },
];

const LABELS: Record<SortOption, string> = {
  "task-count": "Task Count",
  alphabetical: "Alphabetical",
  "due-date": "Due Date",
  "start-date": "Start Date",
  priority: "Priority",
};

// Tapping the active option again flips direction; a third tap clears it —
// same interaction as mobile's SortContent.
export function SortMenu({ sort, onSelect }: { sort: SortState; onSelect: (option: SortOption) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<PropertyPill active={!!sort} icon={<SortAscending size={14} />} />}>
        {sort ? `Sort • ${LABELS[sort.option]}` : "Sort"}
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1">
        {OPTIONS.map(({ option, label, icon: Icon }) => {
          const selected = sort?.option === option;
          const DirectionIcon = sort?.direction === "ascending" ? ArrowUp : ArrowDown;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onSelect(option)}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted",
                selected && "bg-muted text-primary",
              )}
            >
              <span className="flex items-center gap-2">
                <Icon size={16} className={selected ? "text-primary" : "text-muted-foreground"} />
                {label}
              </span>
              {selected && <DirectionIcon size={14} weight="bold" />}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

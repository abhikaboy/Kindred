import {
  ArrowRight,
  CalendarBlank,
  CalendarCheck,
  ChartBar,
  ChartBarHorizontal,
  FunnelSimple,
  Minus,
  WarningCircle,
  type Icon as PhosphorIcon,
} from "@phosphor-icons/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PropertyPill } from "@/components/create/PropertyPill";
import { ThemedText } from "@/components/ThemedText";
import { cn } from "@/lib/utils";
import { activeFilterCount, hasActiveFilters, type FilterState } from "@/lib/taskFilters";

const PRIORITY_OPTIONS: { key: keyof FilterState["priorities"]; label: string; icon: PhosphorIcon; weight?: "fill" }[] = [
  { key: "low", label: "Low", icon: ChartBarHorizontal },
  { key: "medium", label: "Medium", icon: ChartBar },
  { key: "high", label: "High", icon: ChartBar, weight: "fill" },
];

const DEADLINE_OPTIONS: { key: keyof FilterState["deadlines"]; label: string; icon: PhosphorIcon }[] = [
  { key: "overdue", label: "Overdue", icon: WarningCircle },
  { key: "today", label: "Today", icon: CalendarCheck },
  { key: "thisWeek", label: "This Week", icon: CalendarBlank },
  { key: "future", label: "Future", icon: ArrowRight },
  { key: "none", label: "No Deadline", icon: Minus },
];

function FilterChip({
  label,
  icon: Icon,
  selected,
  weight,
  onClick,
}: {
  label: string;
  icon: PhosphorIcon;
  selected: boolean;
  weight?: "fill";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-w-[5rem] flex-1 flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-xs",
        selected
          ? "border-primary bg-primary/10 text-primary"
          : "border-transparent bg-muted text-muted-foreground hover:bg-muted/70",
      )}
    >
      <Icon size={20} weight={weight ?? "regular"} />
      {label}
    </button>
  );
}

export function FilterMenu({
  filters,
  onToggle,
  onClear,
}: {
  filters: FilterState;
  onToggle: (category: keyof FilterState, option: string) => void;
  onClear: () => void;
}) {
  const count = activeFilterCount(filters);

  return (
    <Popover>
      <PopoverTrigger render={<PropertyPill active={count > 0} icon={<FunnelSimple size={14} />} />}>
        {count > 0 ? `Filter • ${count} active` : "Filter"}
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <ThemedText type="smallerDefault" className="font-medium">
              Priority
            </ThemedText>
            <div className="flex flex-wrap gap-2">
              {PRIORITY_OPTIONS.map((o) => (
                <FilterChip
                  key={o.key}
                  label={o.label}
                  icon={o.icon}
                  weight={o.weight}
                  selected={filters.priorities[o.key]}
                  onClick={() => onToggle("priorities", o.key)}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <ThemedText type="smallerDefault" className="font-medium">
              Deadline
            </ThemedText>
            <div className="flex flex-wrap gap-2">
              {DEADLINE_OPTIONS.map((o) => (
                <FilterChip
                  key={o.key}
                  label={o.label}
                  icon={o.icon}
                  selected={filters.deadlines[o.key]}
                  onClick={() => onToggle("deadlines", o.key)}
                />
              ))}
            </div>
          </div>

          {hasActiveFilters(filters) && (
            <button
              type="button"
              onClick={onClear}
              className="text-center text-xs text-muted-foreground hover:text-foreground"
            >
              Clear All Filters
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

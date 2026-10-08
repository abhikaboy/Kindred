import { useState } from "react";
import { CalendarCheck, CaretRight } from "@phosphor-icons/react";
import { $api } from "@/lib/api/query";
import { ThemedText } from "@/components/ThemedText";
import { WeekStory } from "@/components/weekrecap/WeekStory";

// A single line that opens the weekly story. `earlyWeekOnly` limits it to Sunday and Monday.
export function WeekRecapEntry({ earlyWeekOnly = false }: { earlyWeekOnly?: boolean }) {
  const day = new Date().getDay();
  const visible = !earlyWeekOnly || day === 0 || day === 1;
  const [open, setOpen] = useState(false);
  const recap = $api.useQuery("get", "/v1/user/week-recap", {}, { enabled: visible, staleTime: 5 * 60 * 1000 });

  if (!visible || !recap.data) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group -mx-3 flex w-[calc(100%+1.5rem)] items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors duration-150 hover:bg-muted"
      >
        <CalendarCheck size={20} className="shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <ThemedText type="defaultSemiBold" as="p">
            Your week, {recap.data.rangeLabel}
          </ThemedText>
          <ThemedText type="caption" as="p" className="truncate">
            {recap.data.teaser}
          </ThemedText>
        </div>
        <CaretRight size={16} className="shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5" />
      </button>
      <WeekStory recap={recap.data} open={open} onOpenChange={setOpen} />
    </>
  );
}

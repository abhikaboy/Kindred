import { useState } from "react";
import { Repeat } from "@phosphor-icons/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PropertyPill } from "@/components/create/PropertyPill";
import { RecurrenceDetail } from "@/components/create/RecurrenceFields";
import { cn } from "@/lib/utils";
import type { TaskFormState } from "@/hooks/useCreateActions";

type Setter = (updater: (prev: TaskFormState) => TaskFormState) => void;

const WEEKDAYS = [0, 1, 1, 1, 1, 1, 0];
const isWeekdays = (d: number[]) => d.length === 7 && d.every((v, i) => v === WEEKDAYS[i]);

// Short pill label from the recurrence state.
function summary(form: TaskFormState): string | null {
  if (form.flex) return `${form.flex.target}×/${form.flex.period === "daily" ? "day" : form.flex.period === "monthly" ? "mo" : "wk"}`;
  if (!form.recurring) return null;
  if (form.recurFrequency === "weekly") return isWeekdays(form.daysOfWeek) ? "Weekdays" : "Weekly";
  return { daily: "Daily", monthly: "Monthly", yearly: "Yearly" }[form.recurFrequency] ?? "Custom";
}

export function RepeatPopover({ form, setForm }: { form: TaskFormState; setForm: Setter }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const current = summary(form);

  // Merge a recurrence patch (always clears flex for the fixed presets).
  const quick = (patch: Partial<TaskFormState>) => {
    setForm((prev) => ({ ...prev, recurring: true, flex: null, ...patch }));
    setCustom(false);
    setOpen(false);
  };

  const clear = () => {
    setForm((prev) => ({ ...prev, recurring: false, flex: null }));
    setCustom(false);
    setOpen(false);
  };

  const todayDays = () => {
    const d = [0, 0, 0, 0, 0, 0, 0];
    d[new Date().getDay()] = 1;
    return d;
  };

  const OPTIONS: { label: string; onClick: () => void }[] = [
    { label: "Every day", onClick: () => quick({ recurFrequency: "daily", every: 1 }) },
    { label: "Every weekday", onClick: () => quick({ recurFrequency: "weekly", every: 1, daysOfWeek: [...WEEKDAYS] }) },
    { label: "Every week", onClick: () => quick({ recurFrequency: "weekly", every: 1, daysOfWeek: todayDays() }) },
    { label: "Every month", onClick: () => quick({ recurFrequency: "monthly", every: 1 }) },
  ];

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setCustom(false); }}>
      <PopoverTrigger render={<PropertyPill icon={<Repeat size={14} />} active={!!current} />}>
        {current ?? "Repeat"}
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1">
        <button
          type="button"
          onClick={clear}
          className={cn("flex w-full items-center rounded-md px-2 py-1.5 text-sm hover:bg-muted", !form.recurring && !form.flex && "bg-muted")}
        >
          No repeat
        </button>
        {OPTIONS.map((o) => (
          <button key={o.label} type="button" onClick={o.onClick} className="flex w-full items-center rounded-md px-2 py-1.5 text-sm hover:bg-muted">
            {o.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setForm((prev) => ({ ...prev, recurring: true }));
            setCustom((c) => !c);
          }}
          className={cn("flex w-full items-center rounded-md px-2 py-1.5 text-sm hover:bg-muted", custom && "bg-muted")}
        >
          Custom…
        </button>
        {custom && (
          <div className="mt-1 border-t p-2">
            <RecurrenceDetail form={form} setForm={setForm} />
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

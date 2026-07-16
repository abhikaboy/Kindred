import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ThemedText } from "@/components/ThemedText";
import type { TaskFormState } from "@/hooks/useCreateActions";

type Setter = (updater: (prev: TaskFormState) => TaskFormState) => void;

const FREQ_OPTIONS = ["daily", "weekly", "monthly", "yearly"] as const;
const FREQ_LABELS: Record<string, string> = { daily: "Daily", weekly: "Weekly", monthly: "Monthly", yearly: "Yearly" };
const PERIOD_OPTIONS = ["daily", "weekly", "monthly"] as const;
const PERIOD_LABELS: Record<string, string> = { daily: "Day", weekly: "Week", monthly: "Month" };
// index 0 = Sunday, matching daysOfWeek.
const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

const selectClass =
  "h-8 flex-1 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring dark:bg-input/30";

// The custom-recurrence controls (assumes recurring is already on). Vertical,
// compact — meant to live inside the Repeat popover.
export function RecurrenceDetail({ form, setForm }: { form: TaskFormState; setForm: Setter }) {
  const toggleDay = (index: number) =>
    setForm((prev) => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.map((d, i) => (i === index ? (d ? 0 : 1) : d)),
    }));

  const toggleFlex = (on: boolean) =>
    setForm((prev) => ({ ...prev, flex: on ? { target: 1, period: "weekly" } : null }));

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <ThemedText type="caption" className="w-16 text-muted-foreground">Every</ThemedText>
        <Input
          type="number"
          min={1}
          value={form.every}
          onChange={(e) => setForm((prev) => ({ ...prev, every: Math.max(1, Number(e.target.value) || 1) }))}
          className="h-8 w-16"
        />
        <select
          className={selectClass}
          value={form.recurFrequency}
          onChange={(e) => setForm((prev) => ({ ...prev, recurFrequency: e.target.value }))}
        >
          {FREQ_OPTIONS.map((f) => (
            <option key={f} value={f}>{FREQ_LABELS[f]}</option>
          ))}
        </select>
      </div>

      {form.recurFrequency === "weekly" && (
        <div className="flex gap-1">
          {WEEKDAY_LABELS.map((labelText, index) => {
            const on = form.daysOfWeek[index] === 1;
            return (
              <button
                key={index}
                type="button"
                onClick={() => toggleDay(index)}
                className={cn(
                  "size-7 rounded-full text-xs transition-colors",
                  on ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                )}
              >
                {labelText}
              </button>
            );
          })}
        </div>
      )}

      <SegmentedControl
        options={["Rolling", "Buildup"]}
        value={form.behavior === "BUILDUP" ? "Buildup" : "Rolling"}
        onChange={(o) => setForm((prev) => ({ ...prev, behavior: o === "Buildup" ? "BUILDUP" : "ROLLING" }))}
      />

      <div className="flex items-center justify-between">
        <ThemedText type="caption" className="text-muted-foreground">Flex goal</ThemedText>
        <Switch checked={!!form.flex} onCheckedChange={toggleFlex} />
      </div>

      {form.flex && (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            value={form.flex.target}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                flex: prev.flex ? { ...prev.flex, target: Math.max(1, Number(e.target.value) || 1) } : prev.flex,
              }))
            }
            className="h-8 w-16"
          />
          <ThemedText type="caption" className="text-muted-foreground">× per</ThemedText>
          <select
            className={selectClass}
            value={form.flex.period}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, flex: prev.flex ? { ...prev.flex, period: e.target.value } : prev.flex }))
            }
          >
            {PERIOD_OPTIONS.map((p) => (
              <option key={p} value={p}>{PERIOD_LABELS[p]}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

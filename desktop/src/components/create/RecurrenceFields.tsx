import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ThemedText } from "@/components/ThemedText";
import { TaskPropertyRow } from "@/components/create/TaskPropertyRow";
import type { TaskFormState } from "@/hooks/useCreateActions";

type Setter = (updater: (prev: TaskFormState) => TaskFormState) => void;

const FREQ_OPTIONS = ["daily", "weekly", "monthly", "yearly"] as const;
const FREQ_LABELS: Record<string, string> = {
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
    yearly: "Yearly",
};

const PERIOD_OPTIONS = ["daily", "weekly", "monthly"] as const;
const PERIOD_LABELS: Record<string, string> = { daily: "Day", weekly: "Week", monthly: "Month" };

// index 0 = Sunday, matching daysOfWeek.
const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

const selectClass =
    "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export function RecurrenceFields({ form, setForm }: { form: TaskFormState; setForm: Setter }) {
    const toggleRepeat = (on: boolean) =>
        setForm((prev) => ({ ...prev, recurring: on, flex: on ? prev.flex : null }));

    const toggleDay = (index: number) =>
        setForm((prev) => ({
            ...prev,
            daysOfWeek: prev.daysOfWeek.map((d, i) => (i === index ? (d ? 0 : 1) : d)),
        }));

    const toggleFlex = (on: boolean) =>
        setForm((prev) => ({
            ...prev,
            flex: on ? { target: 1, period: "weekly" } : null,
        }));

    return (
        <div className="flex flex-col gap-3">
            <TaskPropertyRow label="Repeat">
                <Switch checked={form.recurring} onCheckedChange={toggleRepeat} />
            </TaskPropertyRow>

            {form.recurring && (
                <div className="flex flex-col gap-3 rounded-2xl border bg-muted/40 p-3">
                    <TaskPropertyRow label="Frequency">
                        <select
                            className={selectClass}
                            value={form.recurFrequency}
                            onChange={(e) =>
                                setForm((prev) => ({ ...prev, recurFrequency: e.target.value }))
                            }
                        >
                            {FREQ_OPTIONS.map((f) => (
                                <option key={f} value={f}>
                                    {FREQ_LABELS[f]}
                                </option>
                            ))}
                        </select>
                    </TaskPropertyRow>

                    <TaskPropertyRow label="Every">
                        <Input
                            type="number"
                            min={1}
                            value={form.every}
                            onChange={(e) =>
                                setForm((prev) => ({
                                    ...prev,
                                    every: Math.max(1, Number(e.target.value) || 1),
                                }))
                            }
                            className="w-20"
                        />
                    </TaskPropertyRow>

                    {form.recurFrequency === "weekly" && (
                        <div className="flex flex-col gap-1.5">
                            <ThemedText type="caption" className="text-muted-foreground">
                                On days
                            </ThemedText>
                            <div className="flex gap-1.5">
                                {WEEKDAY_LABELS.map((label, index) => {
                                    const on = form.daysOfWeek[index] === 1;
                                    return (
                                        <button
                                            key={index}
                                            type="button"
                                            onClick={() => toggleDay(index)}
                                            className={cn(
                                                "size-8 rounded-full border text-sm transition-colors",
                                                on
                                                    ? "border-primary bg-primary/15 text-primary"
                                                    : "border-border text-muted-foreground hover:bg-muted",
                                            )}
                                        >
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col gap-1.5">
                        <ThemedText type="caption" className="text-muted-foreground">
                            Behavior
                        </ThemedText>
                        <SegmentedControl
                            options={["Rolling", "Buildup"]}
                            value={form.behavior === "BUILDUP" ? "Buildup" : "Rolling"}
                            onChange={(o) =>
                                setForm((prev) => ({
                                    ...prev,
                                    behavior: o === "Buildup" ? "BUILDUP" : "ROLLING",
                                }))
                            }
                        />
                    </div>

                    <TaskPropertyRow label="Flex goal">
                        <Switch checked={!!form.flex} onCheckedChange={toggleFlex} />
                    </TaskPropertyRow>

                    {form.flex && (
                        <TaskPropertyRow label="Target">
                            <Input
                                type="number"
                                min={1}
                                value={form.flex.target}
                                onChange={(e) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        flex: prev.flex
                                            ? { ...prev.flex, target: Math.max(1, Number(e.target.value) || 1) }
                                            : prev.flex,
                                    }))
                                }
                                className="w-16"
                            />
                            <ThemedText type="caption" className="text-muted-foreground">
                                × per
                            </ThemedText>
                            <select
                                className={selectClass}
                                value={form.flex.period}
                                onChange={(e) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        flex: prev.flex ? { ...prev.flex, period: e.target.value } : prev.flex,
                                    }))
                                }
                            >
                                {PERIOD_OPTIONS.map((p) => (
                                    <option key={p} value={p}>
                                        {PERIOD_LABELS[p]}
                                    </option>
                                ))}
                            </select>
                        </TaskPropertyRow>
                    )}
                </div>
            )}
        </div>
    );
}

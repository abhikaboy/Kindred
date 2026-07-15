import { Plus, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemedText } from "@/components/ThemedText";
import type { TaskFormState } from "@/hooks/useCreateActions";

type Setter = (updater: (prev: TaskFormState) => TaskFormState) => void;

// datetime-local wants "YYYY-MM-DDTHH:mm" in local time; format the ISO parts.
function isoToLocalInput(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ReminderFields({ form, setForm }: { form: TaskFormState; setForm: Setter }) {
    const setReminderAt = (index: number, local: string) => {
        const iso = local ? new Date(local).toISOString() : "";
        setForm((prev) => ({
            ...prev,
            reminders: prev.reminders.map((r, i) => (i === index ? { triggerTime: iso } : r)),
        }));
    };

    const removeReminder = (index: number) => {
        setForm((prev) => ({
            ...prev,
            reminders: prev.reminders.filter((_, i) => i !== index),
        }));
    };

    const addReminder = () => {
        setForm((prev) => ({
            ...prev,
            reminders: [...prev.reminders, { triggerTime: new Date().toISOString() }],
        }));
    };

    return (
        <div className="flex flex-col gap-2">
            <ThemedText type="caption" className="text-muted-foreground">
                Reminders
            </ThemedText>
            {form.reminders.map((reminder, index) => (
                <div key={index} className="flex items-center gap-2">
                    <Input
                        type="datetime-local"
                        value={isoToLocalInput(reminder.triggerTime)}
                        onChange={(e) => setReminderAt(index, e.target.value)}
                    />
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeReminder(index)}
                        aria-label="Remove reminder"
                    >
                        <X />
                    </Button>
                </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addReminder} className="self-start">
                <Plus />
                Add reminder
            </Button>
        </div>
    );
}

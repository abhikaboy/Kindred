import { format, isSameDay, addDays, startOfDay } from "date-fns";

// Copy helpers for plan surfaces. Words stay gentle: a plan moves, it never fails.

type ChecklistLike = { content: string; completed: boolean; order?: number };
type PlanLike = { step: string; at: string };

const lowerFirst = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);

/** "tonight" / "today" / "tomorrow" / "Thursday", relative to now. */
export function planWhenLabel(at: Date, now: Date = new Date()): string {
    if (isSameDay(at, now)) return at.getHours() >= 17 ? "tonight" : "today";
    if (isSameDay(at, addDays(now, 1))) return "tomorrow";
    return format(at, "EEEE");
}

/** "Yesterday's plan was to open the PDF. Still want to?" */
export function passedPlanCaption(plan: PlanLike, now: Date = new Date()): string {
    const at = new Date(plan.at);
    const day = isSameDay(at, addDays(now, -1)) ? "Yesterday" : format(at, "EEEE");
    const step = plan.step.trim().replace(/[.!?]+$/, "");
    return `${day}'s plan was to ${lowerFirst(step)}. Still want to?`;
}

const sorted = (list: ChecklistLike[]) => [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

/** Unchecked checklist items other than the current step, in order. */
export function stepsAfter(checklist: ChecklistLike[] | undefined, step: string): string[] {
    return sorted(checklist ?? [])
        .filter((c) => !c.completed && c.content !== step)
        .map((c) => c.content);
}

export function moreStepsLabel(count: number): string | null {
    if (count <= 0) return null;
    return `${count} more step${count === 1 ? "" : "s"} after`;
}

/**
 * Checks the plan step off. Returns the new checklist and whether that was the last
 * step, meaning the whole task is done.
 */
export function completeStep<T extends ChecklistLike>(
    checklist: T[] | undefined,
    step: string,
    taskContent: string
): { checklist: T[]; finishesTask: boolean; next: string | null } {
    const list = checklist ?? [];
    let hit = false;
    const updated = list.map((c) => {
        if (!hit && !c.completed && c.content === step) {
            hit = true;
            return { ...c, completed: true };
        }
        return c;
    });
    const remaining = stepsAfter(updated, step);
    // The step was the task itself, or nothing unchecked is left
    const finishesTask = step.trim() === taskContent.trim() || remaining.length === 0;
    return { checklist: updated, finishesTask, next: finishesTask ? null : remaining[0] };
}

/** Same time of day, tomorrow. */
export function sameTimeTomorrow(at: Date, now: Date = new Date()): Date {
    const out = addDays(startOfDay(now), 1);
    out.setHours(at.getHours(), at.getMinutes(), 0, 0);
    return out;
}

/** Parked tasks read "parked 12d" where a waiting one reads "waiting 12d". */
export function parkedLabel(label: string, parked: boolean): string {
    return parked ? label.replace(/^waiting\b/, "parked") : label;
}

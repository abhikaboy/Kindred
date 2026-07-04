export type DayDensity = {
    count: number;
    categoryRefs: { categoryID?: string; categoryName?: string }[];
};

export const dayKey = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const fromDayKey = (key: string): Date => {
    const [y, m, day] = key.split("-").map(Number);
    return new Date(y, m - 1, day);
};

export function countTasksByDay(tasks: any[], start: Date, end: Date): Record<string, DayDensity> {
    const startMs = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
    const endMs = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999).getTime();
    const out: Record<string, DayDensity> = {};

    for (const task of tasks) {
        const days = new Set<string>();
        for (const field of ["startDate", "deadline"] as const) {
            if (!task[field]) continue;
            const date = new Date(task[field]);
            if (date.getTime() < startMs || date.getTime() > endMs) continue;
            days.add(dayKey(date));
        }
        for (const key of days) {
            const bucket = (out[key] ??= { count: 0, categoryRefs: [] });
            bucket.count += 1;
            const ref = { categoryID: task.categoryID, categoryName: task.categoryName };
            if (
                bucket.categoryRefs.length < 3 &&
                !bucket.categoryRefs.some((r) => r.categoryID === ref.categoryID)
            ) {
                bucket.categoryRefs.push(ref);
            }
        }
    }
    return out;
}

// Pure, so tests can load it without the parser or native modules.

export type Moment = { key: string; label: string; at: Date };

const at = (base: Date, days: number, hours: number, minutes = 0) => {
    const d = new Date(base);
    d.setDate(d.getDate() + days);
    d.setHours(hours, minutes, 0, 0);
    return d;
};

// Days until the next `weekday` (0 = Sunday), never today
const daysUntil = (now: Date, weekday: number) => (weekday - now.getDay() + 7) % 7 || 7;

/**
 * The moments people actually mean. Start times land at the start of the
 * moment; deadlines at the end of that day, since "due tomorrow" means by
 * tomorrow night. Past moments drop out ("Tonight" after 7:30pm).
 */
export function quickMoments(now: Date, target: "start" | "due"): Moment[] {
    const inAnHour = new Date(now.getTime() + 60 * 60 * 1000);
    // Round up to the next quarter hour so it reads like a time someone picked
    inAnHour.setMinutes(Math.ceil(inAnHour.getMinutes() / 15) * 15, 0, 0);
    const day = (days: number, startHour: number) => (target === "start" ? at(now, days, startHour) : at(now, days, 23, 59));

    const moments: Moment[] = [{ key: "hour", label: "In an hour", at: inAnHour }];
    if (now.getHours() * 60 + now.getMinutes() < 19 * 60 + 30) {
        moments.push({ key: "tonight", label: "Tonight", at: target === "start" ? at(now, 0, 20) : at(now, 0, 23, 59) });
    }
    moments.push({ key: "tomorrow", label: "Tomorrow", at: day(1, 9) });
    const sat = daysUntil(now, 6);
    // Saturday itself: "Tomorrow" already covers Sunday, so offer next weekend
    moments.push({ key: "weekend", label: sat === 7 ? "Next weekend" : "This weekend", at: day(sat, 10) });
    moments.push({ key: "week", label: "Next week", at: day(daysUntil(now, 1), 9) });
    return moments;
}

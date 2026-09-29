import AsyncStorage from "@react-native-async-storage/async-storage";

// "Not now" on the Build a plan sheet quiets a task's plan nudge for a few days.

const PREFIX = "plan_snooze_";
export const PLAN_SNOOZE_DAYS = 3;

export async function snoozeTask(id: string, now: Date = new Date()): Promise<void> {
    const until = new Date(now.getTime() + PLAN_SNOOZE_DAYS * 86400000);
    await AsyncStorage.setItem(PREFIX + id, until.toISOString()).catch(() => {});
}

/** Task ids still snoozed. Expired snoozes are cleaned up as a side effect. */
export async function getSnoozedIds(now: Date = new Date()): Promise<string[]> {
    try {
        const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(PREFIX));
        if (!keys.length) return [];
        const pairs = await AsyncStorage.multiGet(keys);
        const live: string[] = [];
        const expired: string[] = [];
        for (const [key, value] of pairs) {
            const until = value ? new Date(value).getTime() : NaN;
            if (until > now.getTime()) live.push(key.slice(PREFIX.length));
            else expired.push(key);
        }
        if (expired.length) AsyncStorage.multiRemove(expired).catch(() => {});
        return live;
    } catch {
        return [];
    }
}

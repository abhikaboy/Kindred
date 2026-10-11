import AsyncStorage from "@react-native-async-storage/async-storage";
import { FRESH_LESSON_STATE, isLessonState, type LessonState } from "@/utils/postingLesson/machine";

export const postingLessonKey = (userId: string) => `${userId}-posting-lesson`;

/** The stored lesson state, or a fresh one when absent or unreadable. */
export async function loadLessonState(userId: string): Promise<LessonState> {
    try {
        const raw = await AsyncStorage.getItem(postingLessonKey(userId));
        if (!raw) return FRESH_LESSON_STATE;
        const parsed: unknown = JSON.parse(raw);
        return isLessonState(parsed) ? parsed : FRESH_LESSON_STATE;
    } catch {
        return FRESH_LESSON_STATE;
    }
}

export async function saveLessonState(userId: string, state: LessonState): Promise<void> {
    await AsyncStorage.setItem(postingLessonKey(userId), JSON.stringify(state));
}

export async function clearLessonState(userId: string): Promise<void> {
    await AsyncStorage.removeItem(postingLessonKey(userId));
}

import type { LessonStep } from "@/utils/postingLesson/machine";

// Dev only: lets kindred:///dev-onboarding?demo=<step> start the posting lesson at any step.
type Listener = (step: LessonStep) => void;
const listeners = new Set<Listener>();

export const subscribePostingLessonDemo = (fn: Listener) => {
    listeners.add(fn);
    return () => {
        listeners.delete(fn);
    };
};

export const startPostingLessonDemo = (step: LessonStep) => {
    if (__DEV__) listeners.forEach((fn) => fn(step));
};

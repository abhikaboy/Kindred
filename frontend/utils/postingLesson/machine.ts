// Rules for the "share your win" posting lesson: who is offered it, when, and the step order.
// The lesson rides on a task completion: the 3rd lifetime completion, and once more on the 6th if
// the user skipped it. It is for people who haven't posted yet.

export type LessonStep = "toast" | "camera" | "caption" | "post";

/** Persisted per user. `offers` counts lessons started or skipped; `done` ends it for good. */
export type LessonState = { offers: number; done: boolean };

export const FRESH_LESSON_STATE: LessonState = { offers: 0, done: false };

export const FIRST_OFFER_AT = 3;
export const SECOND_OFFER_AT = 6;
export const MAX_OFFERS = 2;

const STEP_ORDER: readonly LessonStep[] = ["toast", "camera", "caption", "post"];

export function shouldOfferLesson(input: {
    /** Lifetime completions after the one that just happened (from the completion response). */
    tasksComplete: number;
    postsMade: number | null | undefined;
    state: LessonState;
    /** The onboarding coach is running, so this would collide with it. */
    coachBusy: boolean;
}): boolean {
    const { tasksComplete, postsMade, state, coachBusy } = input;
    if (state.done || coachBusy) return false;
    if ((postsMade ?? 0) > 0) return false;
    if (state.offers === 0) return tasksComplete === FIRST_OFFER_AT;
    if (state.offers === 1) return tasksComplete === SECOND_OFFER_AT;
    return false;
}

/** State after a lesson is shown: a second skip, or any later offer, means it is finished. */
export function afterOffer(state: LessonState): LessonState {
    const offers = state.offers + 1;
    return { offers, done: state.done || offers >= MAX_OFFERS };
}

export const completeLesson = (state: LessonState): LessonState => ({ ...state, done: true });

export function nextStep(step: LessonStep): LessonStep | null {
    const i = STEP_ORDER.indexOf(step);
    return i >= 0 && i < STEP_ORDER.length - 1 ? STEP_ORDER[i + 1] : null;
}

/** Steps that live on the posting screens, so leaving them ends the lesson. */
export const isPostingStep = (step: LessonStep | null): boolean => step === "camera" || step === "caption" || step === "post";

export function isLessonState(value: unknown): value is LessonState {
    return (
        typeof value === "object" &&
        value !== null &&
        typeof (value as LessonState).offers === "number" &&
        typeof (value as LessonState).done === "boolean"
    );
}

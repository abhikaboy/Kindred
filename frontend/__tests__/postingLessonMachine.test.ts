import {
    FRESH_LESSON_STATE,
    afterOffer,
    completeLesson,
    isLessonState,
    isPostingStep,
    nextStep,
    shouldOfferLesson,
} from "@/utils/postingLesson/machine";

const base = { postsMade: 0, state: FRESH_LESSON_STATE, coachBusy: false };

describe("shouldOfferLesson", () => {
    test("offers on exactly the 3rd completion", () => {
        expect(shouldOfferLesson({ ...base, tasksComplete: 3 })).toBe(true);
        expect(shouldOfferLesson({ ...base, tasksComplete: 2 })).toBe(false);
        expect(shouldOfferLesson({ ...base, tasksComplete: 4 })).toBe(false);
    });

    test("offers again on the 6th only after one earlier offer", () => {
        const once = { offers: 1, done: false };
        expect(shouldOfferLesson({ ...base, tasksComplete: 6, state: once })).toBe(true);
        expect(shouldOfferLesson({ ...base, tasksComplete: 6 })).toBe(false);
        expect(shouldOfferLesson({ ...base, tasksComplete: 3, state: once })).toBe(false);
    });

    test("never once done or after two offers", () => {
        expect(shouldOfferLesson({ ...base, tasksComplete: 3, state: { offers: 0, done: true } })).toBe(false);
        expect(shouldOfferLesson({ ...base, tasksComplete: 6, state: { offers: 2, done: false } })).toBe(false);
    });

    test("not for people who have posted", () => {
        expect(shouldOfferLesson({ ...base, tasksComplete: 3, postsMade: 1 })).toBe(false);
        expect(shouldOfferLesson({ ...base, tasksComplete: 3, postsMade: undefined })).toBe(true);
    });

    test("not while the onboarding coach is running", () => {
        expect(shouldOfferLesson({ ...base, tasksComplete: 3, coachBusy: true })).toBe(false);
    });
});

describe("state transitions", () => {
    test("the second offer finishes the lesson", () => {
        const first = afterOffer(FRESH_LESSON_STATE);
        expect(first).toEqual({ offers: 1, done: false });
        expect(afterOffer(first)).toEqual({ offers: 2, done: true });
    });

    test("completing marks it done without losing the offer count", () => {
        expect(completeLesson({ offers: 1, done: false })).toEqual({ offers: 1, done: true });
    });

    test("recognizes valid stored state only", () => {
        expect(isLessonState({ offers: 1, done: false })).toBe(true);
        expect(isLessonState({ offers: "1", done: false })).toBe(false);
        expect(isLessonState(null)).toBe(false);
    });
});

describe("steps", () => {
    test("run toast, camera, caption, post, then end", () => {
        expect(nextStep("toast")).toBe("camera");
        expect(nextStep("camera")).toBe("caption");
        expect(nextStep("caption")).toBe("post");
        expect(nextStep("post")).toBeNull();
    });

    test("only the posting-screen steps count as posting steps", () => {
        expect(isPostingStep("toast")).toBe(false);
        expect(isPostingStep(null)).toBe(false);
        expect(isPostingStep("camera")).toBe(true);
        expect(isPostingStep("post")).toBe(true);
    });
});

import {
    isDone,
    normalize,
    OnboardingV2Event,
    OnboardingV2State,
    OnboardingV2Step,
    reduce,
    stepKey,
} from "@/utils/onboardingV2/machine";

const guest = (step: OnboardingV2Step): OnboardingV2State => ({ step, isGuest: true });
const member = (step: OnboardingV2Step): OnboardingV2State => ({ step, isGuest: false });

const EXITS: [OnboardingV2Step, OnboardingV2Event, OnboardingV2Step][] = [
    [0, { type: "REVEAL_WORKSPACES" }, 1],
    [1, { type: "OPEN_GUIDE" }, 2],
    [2, { type: "CATEGORY_CREATED" }, 3],
    [3, { type: "TASK_COMPLETED" }, 4],
    [4, { type: "RINGS_CONTINUE" }, 5],
    [5, { type: "RING_DETAIL_CONTINUE" }, 7],
    [6, { type: "QUICK_ADD_SUBMITTED" }, 7],
    [7, { type: "FINISH" }, 8],
    [8, { type: "ACCOUNT_PROMPT_DONE" }, 9],
];

const STEPS: OnboardingV2Step[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

const ALL_EVENTS: OnboardingV2Event["type"][] = [
    "REVEAL_WORKSPACES",
    "OPEN_GUIDE",
    "CATEGORY_CREATED",
    "TASK_COMPLETED",
    "RINGS_CONTINUE",
    "RING_DETAIL_CONTINUE",
    "QUICK_ADD_SUBMITTED",
    "ACCOUNT_PROMPT_DONE",
    "FINISH",
    "SKIP",
];

describe("onboarding v2 reduce", () => {
    it.each(EXITS)("advances from step %i on %j to step %i for a guest", (from, event, to) => {
        expect(reduce(guest(from), event).step).toBe(to);
    });

    it.each(EXITS.filter(([from]) => from !== 7))("advances from step %i on %j for a member", (from, event, to) => {
        expect(reduce(member(from), event).step).toBe(to);
    });

    it("keeps every other field when advancing", () => {
        const state: OnboardingV2State = { step: 1, isGuest: true };
        expect(reduce(state, { type: "OPEN_GUIDE" })).toEqual({ step: 2, isGuest: true });
    });

    it.each(EXITS)("ignores events other than the exit event at step %i", (from, exit) => {
        for (const type of ALL_EVENTS) {
            if (type === exit.type || type === "SKIP") continue;
            const state = guest(from);
            expect(reduce(state, { type })).toBe(state);
        }
    });

    it("returns the same object on a no-op", () => {
        const state = guest(4);
        expect(reduce(state, { type: "FINISH" })).toBe(state);
    });

    it("skips the account prompt for a non-guest going from 7 to done", () => {
        expect(reduce(member(7), { type: "FINISH" }).step).toBe(9);
    });

    it("enters the account prompt for a guest after the finish step", () => {
        expect(reduce(guest(7), { type: "FINISH" }).step).toBe(8);
    });

    it.each(STEPS.slice(0, 9))("skips to done from step %i", (step) => {
        expect(reduce(guest(step), { type: "SKIP" }).step).toBe(9);
        expect(reduce(member(step), { type: "SKIP" }).step).toBe(9);
    });

    it("treats done as terminal", () => {
        const state = guest(9);
        for (const type of ALL_EVENTS) expect(reduce(state, { type })).toBe(state);
    });
});

describe("onboarding v2 normalize", () => {
    const none = { hasCategoryInGuide: false, hasTaskInGuide: false };

    it("skips step 2 when the guide already has a category", () => {
        expect(normalize(guest(2), { ...none, hasCategoryInGuide: true }).step).toBe(3);
    });

    it("never skips step 3: a task in the guide still has to be completed", () => {
        expect(normalize(guest(3), { ...none, hasTaskInGuide: true }).step).toBe(3);
        const facts = { hasCategoryInGuide: true, hasTaskInGuide: true };
        expect(normalize(guest(2), facts).step).toBe(3);
    });

    it("leaves other steps and unmet facts alone", () => {
        const both = { hasCategoryInGuide: true, hasTaskInGuide: true };
        const state = guest(1);
        expect(normalize(state, both)).toBe(state);
        expect(normalize(guest(2), none).step).toBe(2);
        expect(normalize(guest(3), { ...none, hasCategoryInGuide: true }).step).toBe(3);
    });
});

describe("onboarding v2 isDone and stepKey", () => {
    it("is done only at step 9", () => {
        expect(isDone(9)).toBe(true);
        expect(isDone(8)).toBe(false);
    });

    it("returns the analytics keys", () => {
        const keys = STEPS.map(stepKey);
        expect(keys).toEqual([
            "reveal",
            "openGuide",
            "category",
            "task",
            "rings",
            "ringDetail",
            "quickAdd",
            "finish",
            "account",
            "done",
        ]);
    });
});

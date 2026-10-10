// Pure step machine for onboarding v2. See docs/onboarding-v2-spec.md §3 and §5.

export type OnboardingV2Step = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export const ONBOARDING_V2_DONE: OnboardingV2Step = 9;

const ALL_STEPS: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

export const isOnboardingV2Step = (value: unknown): value is OnboardingV2Step =>
    typeof value === "number" && ALL_STEPS.includes(value);

export type OnboardingV2State = {
    step: OnboardingV2Step;
    isGuest: boolean;
};

export type OnboardingV2Event =
    | { type: "REVEAL_WORKSPACES" }
    | { type: "OPEN_GUIDE" }
    | { type: "CATEGORY_CREATED" }
    | { type: "TASK_COMPLETED" }
    | { type: "RINGS_CONTINUE" }
    | { type: "RING_DETAIL_CONTINUE" }
    | { type: "QUICK_ADD_SUBMITTED" }
    | { type: "ACCOUNT_PROMPT_DONE" }
    | { type: "FINISH" }
    | { type: "SKIP" };

type ActiveStep = Exclude<OnboardingV2Step, 9>;

/** The single event that advances each active step. */
const EXIT_EVENT: Record<ActiveStep, OnboardingV2Event["type"]> = {
    0: "REVEAL_WORKSPACES",
    1: "OPEN_GUIDE",
    2: "CATEGORY_CREATED",
    3: "TASK_COMPLETED",
    4: "RINGS_CONTINUE",
    5: "RING_DETAIL_CONTINUE",
    6: "QUICK_ADD_SUBMITTED",
    7: "FINISH",
    8: "ACCOUNT_PROMPT_DONE",
};

const NEXT_STEP: Record<ActiveStep, OnboardingV2Step> = {
    0: 1,
    1: 2,
    2: 3,
    3: 4,
    4: 5,
    // Step 6 (quick-add dock) is retired: Ring detail goes straight to finish.
    5: 7,
    6: 7,
    7: 8,
    8: 9,
};

const withStep = (state: OnboardingV2State, step: OnboardingV2Step): OnboardingV2State =>
    state.step === step ? state : { ...state, step };

/** Applies an event. Returns the same object when the event does not apply to the current step. */
export function reduce(state: OnboardingV2State, event: OnboardingV2Event): OnboardingV2State {
    if (state.step === ONBOARDING_V2_DONE) return state;
    if (event.type === "SKIP") return withStep(state, ONBOARDING_V2_DONE);
    if (event.type !== EXIT_EVENT[state.step]) return state;
    // Non-guests never see the account prompt (step 8).
    if (state.step === 7 && !state.isGuest) return withStep(state, ONBOARDING_V2_DONE);
    return withStep(state, NEXT_STEP[state.step]);
}

export type OnboardingV2GuideFacts = {
    hasCategoryInGuide: boolean;
    hasTaskInGuide: boolean;
};

/** Advances past step 2 when Kindred Guide already has a category. Step 3 always ends on a completed task. */
export function normalize(state: OnboardingV2State, facts: OnboardingV2GuideFacts): OnboardingV2State {
    let step: OnboardingV2Step = state.step;
    if (step === 2 && facts.hasCategoryInGuide) step = 3;
    return withStep(state, step);
}

export const isDone = (step: OnboardingV2Step): boolean => step === ONBOARDING_V2_DONE;

export type OnboardingV2StepKey =
    | "reveal"
    | "openGuide"
    | "category"
    | "task"
    | "rings"
    | "ringDetail"
    | "quickAdd"
    | "finish"
    | "account"
    | "done";

const STEP_KEYS: Record<OnboardingV2Step, OnboardingV2StepKey> = {
    0: "reveal",
    1: "openGuide",
    2: "category",
    3: "task",
    4: "rings",
    5: "ringDetail",
    6: "quickAdd",
    7: "finish",
    8: "account",
    9: "done",
};

/** Analytics key for a step. The event's step_name is `"v2_" + stepKey(step)`. */
export const stepKey = (step: OnboardingV2Step): OnboardingV2StepKey => STEP_KEYS[step];

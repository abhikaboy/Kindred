// Copy and presentation per onboarding v2 coach step. Step 8 (account) has no card.
export type CoachTarget = "swipeZone" | "workspaceCreate" | "rings" | "dock" | "categoryAdd" | "taskAdd" | "firstTask" | "homeTab";
export type CoachBlur = "target" | "all" | "none";

export type StepContent = {
    title: string;
    body?: string;
    /** Direction of the pointing chevron, if the step has one. */
    cue: "up" | "down" | null;
    target: CoachTarget | null;
    blur: CoachBlur;
    actionLabel?: string;
    /** Step 5 only: Plan, Do, Share, shown one per Continue tap. */
    subSteps?: { title: string; body: string; ring: "plan" | "do" | "share" }[];
};

export type CoachStepKey = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Second half of step 3: the guide has a task, so teach the swipe that completes it. */
export const COMPLETE_TASK_CONTENT: StepContent = {
    title: "Swipe right to complete it",
    cue: null,
    target: "firstTask",
    blur: "target",
};

/** Step 4 on a workspace page: the way back to the rings is the Home icon. */
export const GO_HOME_CONTENT: StepContent = {
    title: "Tap Home to go back",
    body: "Your rings and today's tasks live there.",
    cue: "down",
    target: "homeTab",
    blur: "target",
};

export const STEP_CONTENT: Record<CoachStepKey, StepContent> = {
    0: {
        title: "Swipe up to see your workspaces",
        cue: "up",
        target: "swipeZone",
        blur: "target",
    },
    1: {
        title: "Tap + to create your first workspace",
        cue: "up",
        target: "workspaceCreate",
        blur: "none",
    },
    2: {
        title: "Create a category",
        body: "Tap New Category to group your tasks.",
        cue: "up",
        target: "categoryAdd",
        blur: "target",
    },
    3: {
        title: "Add your first task",
        cue: null,
        target: "taskAdd",
        blur: "target",
    },
    4: {
        title: "Close all three rings each day",
        cue: null,
        target: "rings",
        blur: "target",
        actionLabel: "Continue",
    },
    5: {
        title: "Plan",
        body: "Put 2 tasks on today's list.",
        cue: null,
        target: "rings",
        blur: "target",
        actionLabel: "Continue",
        subSteps: [
            { title: "Plan", body: "Put 2 tasks on today's list.", ring: "plan" },
            { title: "Do", body: "Finish 3 tasks.", ring: "do" },
            { title: "Share", body: "Post a win or send kudos.", ring: "share" },
        ],
    },
    6: {
        title: "Add a task in one line",
        body: "gym @7am tomorrow",
        cue: null,
        target: "dock",
        blur: "target",
    },
    7: {
        title: "You're set",
        cue: null,
        target: null,
        blur: "none",
        actionLabel: "Done",
    },
};

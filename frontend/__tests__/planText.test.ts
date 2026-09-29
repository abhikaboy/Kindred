import {
    completeStep,
    moreStepsLabel,
    parkedLabel,
    passedPlanCaption,
    planWhenLabel,
    sameTimeTomorrow,
    stepsAfter,
} from "@/utils/planText";

const now = new Date(2026, 8, 28, 10, 0); // Monday

describe("planWhenLabel", () => {
    it("reads tonight, today, tomorrow or the weekday", () => {
        expect(planWhenLabel(new Date(2026, 8, 28, 19), now)).toBe("tonight");
        expect(planWhenLabel(new Date(2026, 8, 28, 12), now)).toBe("today");
        expect(planWhenLabel(new Date(2026, 8, 29, 9), now)).toBe("tomorrow");
        expect(planWhenLabel(new Date(2026, 9, 1, 9), now)).toBe("Thursday");
    });
});

describe("passedPlanCaption", () => {
    it("names yesterday and lowercases the step", () => {
        const at = new Date(2026, 8, 27, 19).toISOString();
        expect(passedPlanCaption({ step: "Open last year's return PDF", at }, now)).toBe(
            "Yesterday's plan was to open last year's return PDF. Still want to?"
        );
    });
    it("uses the weekday for older plans and drops trailing punctuation", () => {
        const at = new Date(2026, 8, 24, 19).toISOString();
        expect(passedPlanCaption({ step: "Call the bank.", at }, now)).toBe(
            "Thursday's plan was to call the bank. Still want to?"
        );
    });
});

describe("steps", () => {
    const list = [
        { content: "Open PDF", completed: false, order: 0 },
        { content: "Find W-2", completed: false, order: 1 },
        { content: "Old", completed: true, order: 2 },
        { content: "File", completed: false, order: 3 },
    ];
    it("counts unchecked steps after the current one", () => {
        expect(stepsAfter(list, "Open PDF")).toEqual(["Find W-2", "File"]);
        expect(moreStepsLabel(2)).toBe("2 more steps after");
        expect(moreStepsLabel(1)).toBe("1 more step after");
        expect(moreStepsLabel(0)).toBeNull();
    });
    it("checks off the step and offers the next", () => {
        const out = completeStep(list, "Open PDF", "Do taxes");
        expect(out.checklist[0].completed).toBe(true);
        expect(out.finishesTask).toBe(false);
        expect(out.next).toBe("Find W-2");
    });
    it("finishes the task on the last step", () => {
        const out = completeStep([{ content: "Only", completed: false, order: 0 }], "Only", "Task");
        expect(out.finishesTask).toBe(true);
        expect(out.next).toBeNull();
    });
    it("finishes the task when the step is the whole task", () => {
        expect(completeStep(list, "Do taxes", "Do taxes").finishesTask).toBe(true);
        expect(completeStep(undefined, "Anything", "Task").finishesTask).toBe(true);
    });
});

describe("sameTimeTomorrow and parkedLabel", () => {
    it("keeps the time of day", () => {
        const out = sameTimeTomorrow(new Date(2026, 8, 20, 19, 30), now);
        expect([out.getDate(), out.getHours(), out.getMinutes()]).toEqual([29, 19, 30]);
    });
    it("swaps waiting for parked", () => {
        expect(parkedLabel("waiting 12d", true)).toBe("parked 12d");
        expect(parkedLabel("waiting 12d", false)).toBe("waiting 12d");
    });
});

import { phaseDots } from "@/utils/onboardingV2/progress";

describe("phaseDots", () => {
    test.each([
        [0, 0],
        [1, 0],
        [2, 1],
        [3, 2],
        [4, 3],
        [5, 3],
        [6, 4],
    ])("step %i maps to phase %i of 5", (step, index) => {
        expect(phaseDots(step)).toEqual({ index, total: 5 });
    });

    test.each([7, 8, -1, 9, 1.5, NaN])("step %p has no dots", (step) => {
        expect(phaseDots(step)).toBeNull();
    });
});

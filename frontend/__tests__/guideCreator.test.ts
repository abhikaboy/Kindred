import { registerGuideCreator, tryCreateGuide } from "@/utils/onboardingV2/guideCreator";

describe("guideCreator", () => {
    test("returns false with no creator registered", () => {
        expect(tryCreateGuide()).toBe(false);
    });

    test("calls the registered creator and reports it consumed the tap", () => {
        const fn = jest.fn();
        const off = registerGuideCreator(fn);
        expect(tryCreateGuide()).toBe(true);
        expect(fn).toHaveBeenCalledTimes(1);
        off();
        expect(tryCreateGuide()).toBe(false);
    });

    test("a stale cleanup does not remove a newer creator", () => {
        const first = jest.fn();
        const second = jest.fn();
        const offFirst = registerGuideCreator(first);
        const offSecond = registerGuideCreator(second);
        offFirst();
        expect(tryCreateGuide()).toBe(true);
        expect(second).toHaveBeenCalled();
        offSecond();
    });
});

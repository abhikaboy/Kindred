import React from "react";
import { AccessibilityInfo } from "react-native";
import { render, act } from "@testing-library/react-native";
import CoachSwipeArrow from "@/components/onboarding/CoachSwipeArrow";

describe("CoachSwipeArrow", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    test("renders one chevron, non-interactive", async () => {
        jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
        const { getByTestId, getAllByTestId } = render(<CoachSwipeArrow />);
        await act(async () => {});
        expect(getByTestId("coach-swipe-arrow").props.pointerEvents).toBe("none");
        expect(getAllByTestId("coach-swipe-arrow-chevron")).toHaveLength(1);
    });

    test("renders static chevrons under reduced motion", async () => {
        jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
        const { getAllByTestId } = render(<CoachSwipeArrow direction="down" />);
        await act(async () => {});
        expect(getAllByTestId("coach-swipe-arrow-chevron")).toHaveLength(1);
    });

    test("renders nothing when not visible", () => {
        const { queryByTestId } = render(<CoachSwipeArrow visible={false} />);
        expect(queryByTestId("coach-swipe-arrow")).toBeNull();
    });
});

import React from "react";
import { render, act } from "@testing-library/react-native";
import OnboardingV2Host from "@/components/onboarding/OnboardingV2Host";

// Reanimated v4 pulls in react-native-worklets at import time, which crashes under jest
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));

let mockCtx: { step: number | null; isGuest: boolean; dispatch: jest.Mock };
jest.mock("@/contexts/OnboardingV2Context", () => ({ useOnboardingV2Context: () => mockCtx }));
jest.mock("@/hooks/useAnalytics", () => ({ useAnalytics: () => ({ capture: jest.fn() }) }));
jest.mock("@/hooks/useAccountOverlay", () => ({ useAccountOverlay: () => ({ visible: false }), openAccountOverlay: jest.fn() }));
jest.mock("@/contexts/tasksContext", () => ({
    useTasks: () => ({ addWorkspace: jest.fn(), doesWorkspaceExist: jest.fn(), setSelected: jest.fn(), workspaces: [] }),
}));
jest.mock("@/api/workspace", () => ({ createWorkspace: jest.fn() }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const setStep = (step: number) => {
    mockCtx = { step, isGuest: true, dispatch: jest.fn() };
};
const cardHidden = (q: ReturnType<typeof render>) => q.getByTestId("onboarding-coach-slot").findByProps({ pointerEvents: "none" }) != null;

describe("new workspace reveal", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    test("after creating the workspace the card stays hidden, then appears", () => {
        setStep(1);
        const q = render(<OnboardingV2Host active workspacePage />);
        setStep(2);
        q.rerender(<OnboardingV2Host active workspacePage />);
        expect(cardHidden(q)).toBe(true);
        act(() => {
            jest.advanceTimersByTime(2900);
        });
        expect(cardHidden(q)).toBe(true);
        act(() => {
            jest.advanceTimersByTime(1100);
        });
        expect(() => q.getByTestId("onboarding-coach-slot").findByProps({ pointerEvents: "box-none" })).not.toThrow();
    });
});

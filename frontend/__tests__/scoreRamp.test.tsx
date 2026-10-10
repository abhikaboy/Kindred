import React from "react";
import { act, render } from "@testing-library/react-native";
import ScoreRamp from "@/components/onboarding/ScoreRamp";
import { ScoreWithInfo } from "@/components/profile/ProductivityRings";
import { useOnboardingV2Context } from "@/contexts/OnboardingV2Context";
import { hapticCompletionBurst } from "@/utils/haptics";

jest.mock("@/utils/haptics", () => ({ hapticCompletionBurst: jest.fn() }));
jest.mock("@/contexts/OnboardingV2Context", () => ({ useOnboardingV2Context: jest.fn() }));
jest.mock("expo-router", () => ({ router: {}, useRouter: () => ({}), useFocusEffect: jest.fn() }));
jest.mock("@/components/modals/DefaultModal", () => ({
    __esModule: true,
    default: ({ visible, children }: { visible: boolean; children: React.ReactNode }) => (visible ? children : null),
}));
jest.mock("@/utils/showToast", () => ({ showToast: jest.fn() }));
jest.mock("@/components/modals/EncourageModal", () => () => null);
jest.mock("@/components/modals/RewardUnboxingModal", () => () => null);
jest.mock("@/components/profile/ExpandedRingDetail", () => () => null);
jest.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null }) }));
jest.mock("@/hooks/useRings", () => ({ useRings: () => ({}) }));
jest.mock("@/hooks/useFirstTouchHint", () => ({
    useFirstTouchHint: () => ({ ready: false, done: jest.fn() }),
}));

const mockContext = useOnboardingV2Context as jest.Mock;
const mockHaptic = hapticCompletionBurst as jest.Mock;

function setStep(step: number | null) {
    mockContext.mockReturnValue({ step, state: null, isGuest: false, dispatch: jest.fn(), isLoading: false });
}

beforeEach(() => {
    jest.useFakeTimers();
    mockHaptic.mockClear();
});

afterEach(() => {
    jest.useRealTimers();
});

describe("ScoreWithInfo onboarding score", () => {
    test("renders 0 during onboarding", () => {
        setStep(3);
        const { getByText, queryByText } = render(<ScoreWithInfo score={30} />);
        expect(getByText("0")).toBeTruthy();
        expect(queryByText("30")).toBeNull();
    });

    test("renders the server score when not onboarding", () => {
        setStep(null);
        const { getByText } = render(<ScoreWithInfo score={30} />);
        expect(getByText("30")).toBeTruthy();
    });

    test("does not play the ramp on mount when already done", () => {
        setStep(9);
        const { getByText } = render(<ScoreWithInfo score={30} />);
        act(() => {
            jest.runAllTimers();
        });
        expect(getByText("30")).toBeTruthy();
        expect(mockHaptic).not.toHaveBeenCalled();
    });

    test("plays the ramp once when the finish step (7) ends and fires the haptic once", () => {
        setStep(7);
        const { getByText, rerender } = render(<ScoreWithInfo score={30} />);
        expect(getByText("0")).toBeTruthy();

        setStep(8);
        rerender(<ScoreWithInfo score={30} />);
        act(() => {
            jest.runAllTimers();
        });
        expect(getByText("30")).toBeTruthy();
        expect(mockHaptic).toHaveBeenCalledTimes(1);

        rerender(<ScoreWithInfo score={30} />);
        act(() => {
            jest.runAllTimers();
        });
        expect(mockHaptic).toHaveBeenCalledTimes(1);
    });

    test("a skip from an early step to done does not play the ramp or the haptic", () => {
        setStep(3);
        const { getByText, rerender } = render(<ScoreWithInfo score={30} />);
        setStep(9);
        rerender(<ScoreWithInfo score={30} />);
        act(() => {
            jest.runAllTimers();
        });
        expect(getByText("30")).toBeTruthy();
        expect(mockHaptic).not.toHaveBeenCalled();
    });
});

describe("ScoreRamp", () => {
    test("does not play when playing is false", () => {
        const onDone = jest.fn();
        const { getByText } = render(<ScoreRamp target={30} playing={false} onDone={onDone} />);
        act(() => {
            jest.runAllTimers();
        });
        expect(getByText("30")).toBeTruthy();
        expect(onDone).not.toHaveBeenCalled();
        expect(mockHaptic).not.toHaveBeenCalled();
    });

    test("calls the haptic helper once and onDone once on completion", () => {
        const onDone = jest.fn();
        render(<ScoreRamp target={30} playing onDone={onDone} />);
        act(() => {
            jest.runAllTimers();
        });
        expect(mockHaptic).toHaveBeenCalledTimes(1);
        expect(onDone).toHaveBeenCalledTimes(1);
    });
});

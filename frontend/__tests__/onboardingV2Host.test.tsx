import React from "react";
import { render, fireEvent, act, waitFor, within } from "@testing-library/react-native";
import { Dimensions, StyleSheet, type StyleProp, type View, type ViewStyle } from "react-native";
import { tryCreateGuide } from "@/utils/onboardingV2/guideCreator";
import { registerCoachAnchor } from "@/utils/onboardingV2/coachAnchors";
import OnboardingV2Host from "@/components/onboarding/OnboardingV2Host";
import { AnalyticsEvents } from "@/utils/analytics";
import { openAccountOverlay } from "@/hooks/useAccountOverlay";
import { createWorkspace } from "@/api/workspace";
import { ONBOARDING_WORKSPACE } from "@/constants/spotlightConfig";
import { useTasks } from "@/contexts/tasksContext";

// Reanimated v4 pulls in react-native-worklets at import time, which crashes under jest
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));

let mockCtx: { step: number | null; isGuest: boolean; dispatch: jest.Mock };
const mockCapture = jest.fn();
let mockOverlayVisible = false;

jest.mock("@/contexts/OnboardingV2Context", () => ({
    useOnboardingV2Context: () => mockCtx,
}));
jest.mock("@/hooks/useAnalytics", () => ({
    useAnalytics: () => ({ capture: mockCapture }),
}));
jest.mock("@/hooks/useAccountOverlay", () => ({
    useAccountOverlay: () => ({ visible: mockOverlayVisible }),
    openAccountOverlay: jest.fn(),
}));
const mockTasks: any = { addWorkspace: jest.fn(), doesWorkspaceExist: jest.fn(), setSelected: jest.fn(), workspaces: [] };
jest.mock("@/contexts/tasksContext", () => ({
    useTasks: () => mockTasks,
}));
jest.mock("@/api/workspace", () => ({
    createWorkspace: jest.fn(),
}));
jest.mock("react-native-safe-area-context", () => ({
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const setStep = (step: number | null, isGuest = true) => {
    mockCtx = { step, isGuest, dispatch: jest.fn() };
};

const { width: W, height: H } = Dimensions.get("window");
const RINGS = { x: 20, y: 200, width: 350, height: 180 };
const DOCK = { x: 20, y: H - 150, width: 350, height: 50 };
// Card height is the estimate until onLayout runs (jest has no layout).
const COACH_HEIGHT = 110;
const COACH_HEIGHT_WITH_BODY = 140;
const GAP = 12;
const CUE_HEIGHT = 28;

type R = { x: number; y: number; width: number; height: number };
const anchor = (key: Parameters<typeof registerCoachAnchor>[0], r: R) => {
    const node = { measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => cb(r.x, r.y, r.width, r.height) };
    return registerCoachAnchor(key, { current: node } as unknown as React.RefObject<View | null>);
};

const slotTop = (style: StyleProp<ViewStyle>) => StyleSheet.flatten(style).top;

beforeEach(() => {
    mockCapture.mockClear();
    mockOverlayVisible = false;
    (openAccountOverlay as jest.Mock).mockClear();
    mockTasks.workspaces = [];
    mockTasks.addWorkspace.mockClear();
    mockTasks.setSelected.mockClear();
    mockTasks.doesWorkspaceExist.mockReset().mockReturnValue(false);
    (createWorkspace as jest.Mock).mockReset().mockResolvedValue({ name: "!-proxy-!" });
});

describe("OnboardingV2Host copy", () => {
    test.each([
        [0, "Swipe up to see your workspaces", null],
        [1, "Tap + to create your first workspace", null],
        [2, "Create a category", "Tap New Category to group your tasks."],
        [3, "Add your first task", null],
        [4, "Close all three rings each day", null],
        [6, "Add a task in one line", "gym @7am tomorrow"],
        [7, "You're set", null],
    ])("step %i shows its title and only an informative body", (step, title, body) => {
        setStep(step);
        const { getByTestId, queryByText } = render(<OnboardingV2Host active />);
        expect(getByTestId("onboarding-coach-copy").props.children).toBe(title);
        if (body) expect(queryByText(body)).toBeTruthy();
    });

    test("step 3 asks for a category first when the guide has none", () => {
        mockTasks.workspaces = [{ name: ONBOARDING_WORKSPACE, categories: [] }];
        setStep(3);
        const { getByTestId } = render(<OnboardingV2Host active />);
        expect(getByTestId("onboarding-coach-copy").props.children).toBe("Create a category");
    });

    test("step 3 teaches the swipe once the guide has a task", () => {
        mockTasks.workspaces = [{ name: ONBOARDING_WORKSPACE, categories: [{ id: "c1", tasks: [{}] }] }];
        setStep(3);
        const { getByTestId } = render(<OnboardingV2Host active />);
        expect(getByTestId("onboarding-coach-copy").props.children).toBe("Swipe right to complete it");
    });

    test("step 4 on a workspace page teaches the Home icon", () => {
        setStep(4);
        const { getByTestId } = render(<OnboardingV2Host active workspacePage />);
        expect(getByTestId("onboarding-coach-copy").props.children).toBe("Tap Home to go back");
    });

    test("step 5 shows each ring's goal and a colored dot", () => {
        setStep(5);
        const { getByTestId, getByText } = render(<OnboardingV2Host active />);
        expect(getByText("Put 2 tasks on today's list.")).toBeTruthy();
        expect(getByTestId("onboarding-coach-accent")).toBeTruthy();
    });

    test("steps other than 5 have no accent dot", () => {
        setStep(4);
        expect(render(<OnboardingV2Host active />).queryByTestId("onboarding-coach-accent")).toBeNull();
    });

    test("step 0 has no tap action, only Skip", () => {
        setStep(0);
        const { queryByTestId, getByTestId } = render(<OnboardingV2Host active />);
        expect(queryByTestId("onboarding-coach-action")).toBeNull();
        expect(getByTestId("onboarding-coach-skip")).toBeTruthy();
    });

    test("is hidden when inactive or done", () => {
        setStep(4);
        const inactive = render(<OnboardingV2Host active={false} />);
        expect(inactive.getByTestId("onboarding-coach").props.pointerEvents).toBe("none");
        inactive.unmount();

        setStep(9);
        expect(render(<OnboardingV2Host active />).getByTestId("onboarding-coach").props.pointerEvents).toBe("none");
    });
});

describe("OnboardingV2Host step 1 create", () => {
    test("step 1 has no card action, only Skip", () => {
        setStep(1);
        const { queryByTestId, getByTestId } = render(<OnboardingV2Host active />);
        expect(queryByTestId("onboarding-coach-action")).toBeNull();
        expect(getByTestId("onboarding-coach-skip")).toBeTruthy();
    });

    test("the header + creates the guide, selects it, and dispatches OPEN_GUIDE", async () => {
        setStep(1);
        render(<OnboardingV2Host active />);
        let consumed = false;
        await act(async () => {
            consumed = tryCreateGuide();
        });
        expect(consumed).toBe(true);
        expect(createWorkspace).toHaveBeenCalledWith(ONBOARDING_WORKSPACE);
        expect(mockTasks.addWorkspace).toHaveBeenCalledWith(ONBOARDING_WORKSPACE, { name: "!-proxy-!" });
        expect(mockTasks.setSelected).toHaveBeenCalledWith(ONBOARDING_WORKSPACE);
        expect(mockCtx.dispatch).toHaveBeenCalledWith({ type: "OPEN_GUIDE" });
    });

    test("outside step 1 the + is not consumed, so the normal sheet opens", () => {
        setStep(4);
        render(<OnboardingV2Host active />);
        expect(tryCreateGuide()).toBe(false);
    });

    test("does not create a second guide when one already exists", async () => {
        mockTasks.doesWorkspaceExist.mockReturnValue(true);
        setStep(1);
        render(<OnboardingV2Host active />);
        await act(async () => {
            tryCreateGuide();
        });
        expect(createWorkspace).not.toHaveBeenCalled();
        expect(mockTasks.setSelected).toHaveBeenCalledWith(ONBOARDING_WORKSPACE);
        expect(mockCtx.dispatch).toHaveBeenCalledWith({ type: "OPEN_GUIDE" });
    });

    test("a failed create keeps step 1 and does not dispatch", async () => {
        (createWorkspace as jest.Mock).mockRejectedValue(new Error("network"));
        setStep(1);
        render(<OnboardingV2Host active />);
        await act(async () => {
            tryCreateGuide();
        });
        expect(mockTasks.addWorkspace).not.toHaveBeenCalled();
        expect(mockCtx.dispatch).not.toHaveBeenCalled();
    });

    test("double taps create only once", async () => {
        setStep(1);
        render(<OnboardingV2Host active />);
        await act(async () => {
            tryCreateGuide();
            tryCreateGuide();
        });
        expect(createWorkspace).toHaveBeenCalledTimes(1);
    });

    test("with the + measured the card sits below it with an up chevron between them, and nothing is blurred", async () => {
        const PLUS = { x: 330, y: 80, width: 32, height: 32 };
        const unregister = anchor("workspaceCreate", PLUS);
        setStep(1);
        const { findByTestId, getByTestId, queryByTestId } = render(<OnboardingV2Host active />);
        expect(await findByTestId("coach-swipe-arrow")).toBeTruthy();
        await waitFor(() =>
            expect(slotTop(getByTestId("onboarding-coach-slot").props.style)).toBe(
                PLUS.y + PLUS.height + GAP + CUE_HEIGHT + GAP
            )
        );
        expect(queryByTestId("coach-backdrop")).toBeNull();
        expect(queryByTestId("coach-spotlight")).toBeNull();
        unregister();
    });

    test("without the + on screen step 1 shows nothing, but the + still creates the guide", async () => {
        setStep(1);
        const { queryByTestId, getByTestId } = render(<OnboardingV2Host active />);
        expect(queryByTestId("coach-swipe-arrow")).toBeNull();
        expect(getByTestId("onboarding-coach").props.pointerEvents).toBe("none");
        await act(async () => {
            expect(tryCreateGuide()).toBe(true);
        });
        expect(mockCtx.dispatch).toHaveBeenCalledWith({ type: "OPEN_GUIDE" });
    });

    test("a failed create logs a warning and stays retryable", async () => {
        const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
        (createWorkspace as jest.Mock).mockRejectedValueOnce(new Error("network"));
        setStep(1);
        render(<OnboardingV2Host active />);
        await act(async () => {
            tryCreateGuide();
        });
        expect(warn).toHaveBeenCalled();
        await act(async () => {
            tryCreateGuide();
        });
        expect(mockCtx.dispatch).toHaveBeenCalledWith({ type: "OPEN_GUIDE" });
        warn.mockRestore();
    });
});

describe("OnboardingV2Host actions", () => {
    test("step 4 Continue dispatches RINGS_CONTINUE", () => {
        setStep(4);
        const { getByTestId } = render(<OnboardingV2Host active />);
        fireEvent.press(getByTestId("onboarding-coach-action"));
        expect(mockCtx.dispatch).toHaveBeenCalledWith({ type: "RINGS_CONTINUE" });
    });

    test("step 5 walks Plan, Do, Share before dispatching RING_DETAIL_CONTINUE", () => {
        setStep(5);
        const { getByTestId } = render(<OnboardingV2Host active />);
        expect(getByTestId("onboarding-coach-copy").props.children).toBe("Plan");
        fireEvent.press(getByTestId("onboarding-coach-action"));
        expect(getByTestId("onboarding-coach-copy").props.children).toBe("Do");
        fireEvent.press(getByTestId("onboarding-coach-action"));
        expect(getByTestId("onboarding-coach-copy").props.children).toBe("Share");
        expect(mockCtx.dispatch).not.toHaveBeenCalled();
        fireEvent.press(getByTestId("onboarding-coach-action"));
        expect(mockCtx.dispatch).toHaveBeenCalledTimes(1);
        expect(mockCtx.dispatch).toHaveBeenCalledWith({ type: "RING_DETAIL_CONTINUE" });
    });

    test("step 7 Done dispatches FINISH", () => {
        setStep(7);
        const { getByTestId } = render(<OnboardingV2Host active />);
        fireEvent.press(getByTestId("onboarding-coach-action"));
        expect(mockCtx.dispatch).toHaveBeenCalledWith({ type: "FINISH" });
    });

    test("Skip dispatches SKIP on a coach step", () => {
        setStep(4);
        const { getByTestId } = render(<OnboardingV2Host active />);
        fireEvent.press(getByTestId("onboarding-coach-skip"));
        expect(mockCtx.dispatch).toHaveBeenCalledWith({ type: "SKIP" });
    });

    test("step 6 has no action (advances on quick add, not a tap)", () => {
        setStep(6);
        const { queryByTestId } = render(<OnboardingV2Host active />);
        expect(queryByTestId("onboarding-coach-action")).toBeNull();
    });

    test("step 7 shows Done", () => {
        setStep(7);
        const { getByTestId } = render(<OnboardingV2Host active />);
        expect(getByTestId("onboarding-coach-action").props.accessibilityLabel).toBe("Done");
    });
});

describe("OnboardingV2Host layout", () => {
    test("step 4 sits below the rings", async () => {
        const off = anchor("rings", RINGS);
        setStep(4);
        const { getByTestId } = render(<OnboardingV2Host active />);
        await waitFor(() =>
            expect(slotTop(getByTestId("onboarding-coach-slot").props.style)).toBe(RINGS.y + RINGS.height + GAP)
        );
        off();
    });

    test("step 5 sits below the rings", async () => {
        const off = anchor("rings", RINGS);
        setStep(5);
        const { getByTestId } = render(<OnboardingV2Host active />);
        await waitFor(() =>
            expect(slotTop(getByTestId("onboarding-coach-slot").props.style)).toBe(RINGS.y + RINGS.height + GAP)
        );
        off();
    });

    test("step 6 sits above the dock", async () => {
        const off = anchor("dock", DOCK);
        setStep(6);
        const { getByTestId } = render(<OnboardingV2Host active />);
        await waitFor(() =>
            expect(slotTop(getByTestId("onboarding-coach-slot").props.style)).toBe(DOCK.y - GAP - COACH_HEIGHT_WITH_BODY)
        );
        off();
    });

    test("a target step with no measured frame uses the centered-low fallback", () => {
        setStep(4);
        const { getByTestId } = render(<OnboardingV2Host active />);
        expect(slotTop(getByTestId("onboarding-coach-slot").props.style)).toBe(H * 0.6 - COACH_HEIGHT / 2);
    });

    test("the overlay root and card slot are box-none, the blur is touch-transparent, and the card action fires", async () => {
        const off = anchor("rings", RINGS);
        setStep(4);
        const { getByTestId, findByTestId } = render(<OnboardingV2Host active />);
        expect(getByTestId("onboarding-coach-slot").parent?.props.pointerEvents).toBe("box-none");
        expect(getByTestId("onboarding-coach-slot").props.pointerEvents).toBe("box-none");
        expect((await findByTestId("coach-spotlight")).props.pointerEvents).toBe("none");
        fireEvent.press(getByTestId("onboarding-coach-action"));
        expect(mockCtx.dispatch).toHaveBeenCalledWith({ type: "RINGS_CONTINUE" });
        off();
    });
});

describe("OnboardingV2Host blur and swipe cue", () => {
    test("target steps with a frame blur around it, never the whole screen", async () => {
        const off = anchor("rings", RINGS);
        setStep(4);
        const { findByTestId, queryByTestId } = render(<OnboardingV2Host active />);
        expect(await findByTestId("coach-spotlight")).toBeTruthy();
        expect(queryByTestId("coach-backdrop")).toBeNull();
        off();
    });

    test("a target step with no frame renders no blur but still shows the card", () => {
        setStep(4);
        const { queryByTestId, getByTestId } = render(<OnboardingV2Host active />);
        expect(queryByTestId("coach-spotlight")).toBeNull();
        expect(queryByTestId("coach-backdrop")).toBeNull();
        expect(getByTestId("onboarding-coach-copy")).toBeTruthy();
    });

    test.each([
        [0, "workspacesHandle", { x: 150, y: H - 200, width: 90, height: 24 }],
        [2, "categoryAdd", { x: 100, y: 500, width: 190, height: 36 }],
        [3, "taskAdd", { x: 330, y: 300, width: 32, height: 32 }],
        [4, "rings", RINGS],
        [5, "rings", RINGS],
        [6, "dock", DOCK],
    ] as const)("step %i renders the spotlight around its anchor", async (step, key, rect) => {
        const off = anchor(key, rect);
        setStep(step);
        const { findByTestId } = render(<OnboardingV2Host active />);
        expect(await findByTestId("coach-spotlight")).toBeTruthy();
        off();
    });

    test("step 1 never blurs, even with the + measured", async () => {
        const off = anchor("workspaceCreate", { x: 330, y: 80, width: 32, height: 32 });
        setStep(1);
        const { findByTestId, queryByTestId } = render(<OnboardingV2Host active />);
        await findByTestId("coach-swipe-arrow");
        expect(queryByTestId("coach-backdrop")).toBeNull();
        expect(queryByTestId("coach-spotlight")).toBeNull();
        off();
    });

    test("step 7 has no blur and sits centered low", () => {
        setStep(7);
        const { queryByTestId, getByTestId } = render(<OnboardingV2Host active />);
        expect(queryByTestId("coach-backdrop")).toBeNull();
        expect(queryByTestId("coach-spotlight")).toBeNull();
        expect(slotTop(getByTestId("onboarding-coach-slot").props.style)).toBe(H * 0.6 - COACH_HEIGHT / 2);
    });

    test("step 0 sharpens only the Workspaces handle, with the card and an up chevron above it", async () => {
        const HANDLE = { x: 150, y: H - 200, width: 90, height: 24 };
        const off = anchor("workspacesHandle", HANDLE);
        setStep(0);
        const { findByTestId, getByTestId } = render(<OnboardingV2Host active />);
        expect(await findByTestId("coach-spotlight")).toBeTruthy();
        expect(await findByTestId("coach-swipe-arrow")).toBeTruthy();
        await waitFor(() =>
            expect(slotTop(getByTestId("onboarding-coach-slot").props.style)).toBe(
                HANDLE.y - GAP - COACH_HEIGHT
            )
        );
        off();
    });

    test("step 0 without a registered handle has no blur and no chevron", () => {
        setStep(0);
        const { queryByTestId } = render(<OnboardingV2Host active />);
        expect(queryByTestId("coach-spotlight")).toBeNull();
        expect(queryByTestId("coach-swipe-arrow")).toBeNull();
    });

    test.each([2, 4, 6, 8])("no swipe cue on step %i", (step) => {
        setStep(step);
        expect(render(<OnboardingV2Host active />).queryByTestId("coach-swipe-arrow")).toBeNull();
    });
});

describe("OnboardingV2Host step 7 finish timer", () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });
    afterEach(() => {
        jest.useRealTimers();
    });

    test("dispatches FINISH 6 seconds after step 7 is shown", () => {
        setStep(7);
        render(<OnboardingV2Host active />);
        act(() => {
            jest.advanceTimersByTime(5999);
        });
        expect(mockCtx.dispatch).not.toHaveBeenCalled();
        act(() => {
            jest.advanceTimersByTime(1);
        });
        expect(mockCtx.dispatch).toHaveBeenCalledTimes(1);
        expect(mockCtx.dispatch).toHaveBeenCalledWith({ type: "FINISH" });
    });

    test("does not start before step 7", () => {
        setStep(6);
        render(<OnboardingV2Host active />);
        act(() => {
            jest.advanceTimersByTime(10000);
        });
        expect(mockCtx.dispatch).not.toHaveBeenCalled();
    });

    test("is cleared when the step changes", () => {
        setStep(7);
        const { rerender } = render(<OnboardingV2Host active />);
        mockCtx = { ...mockCtx, step: 8 };
        rerender(<OnboardingV2Host active />);
        act(() => {
            jest.advanceTimersByTime(10000);
        });
        expect(mockCtx.dispatch).not.toHaveBeenCalled();
    });

    test("is cleared on unmount", () => {
        setStep(7);
        const { unmount } = render(<OnboardingV2Host active />);
        unmount();
        act(() => {
            jest.advanceTimersByTime(10000);
        });
        expect(mockCtx.dispatch).not.toHaveBeenCalled();
    });
});

describe("OnboardingV2Host account step", () => {
    test("guest at step 8 opens the account overlay after the score count-up", () => {
        jest.useFakeTimers();
        setStep(8, true);
        render(<OnboardingV2Host active />);
        expect(openAccountOverlay).not.toHaveBeenCalled();
        act(() => {
            jest.advanceTimersByTime(2600);
        });
        expect(openAccountOverlay).toHaveBeenCalledWith("skipped-tutorial");
        expect(mockCtx.dispatch).not.toHaveBeenCalled();
        jest.useRealTimers();
    });

    test("non-guest at step 8 is passed straight through", () => {
        setStep(8, false);
        render(<OnboardingV2Host active />);
        expect(openAccountOverlay).not.toHaveBeenCalled();
        expect(mockCtx.dispatch).toHaveBeenCalledWith({ type: "ACCOUNT_PROMPT_DONE" });
    });

    test("dispatches ACCOUNT_PROMPT_DONE once the overlay closes", () => {
        setStep(8, true);
        mockOverlayVisible = true;
        const { rerender } = render(<OnboardingV2Host active />);
        expect(mockCtx.dispatch).not.toHaveBeenCalled();
        mockOverlayVisible = false;
        rerender(<OnboardingV2Host active />);
        expect(mockCtx.dispatch).toHaveBeenCalledWith({ type: "ACCOUNT_PROMPT_DONE" });
    });
});

describe("OnboardingV2Host workspace page", () => {
    test.each([2, 3])("shows step %i on a workspace page", (step) => {
        setStep(step);
        const { getByTestId } = render(<OnboardingV2Host active workspacePage />);
        expect(getByTestId("onboarding-coach").props.pointerEvents).toBe("box-none");
        expect(getByTestId("onboarding-coach-skip")).toBeTruthy();
    });

    test("step 1 stays hidden on a workspace page, where the + is not on screen", () => {
        setStep(1);
        const { getByTestId } = render(<OnboardingV2Host active workspacePage />);
        expect(getByTestId("onboarding-coach").props.pointerEvents).toBe("none");
    });

    test.each([0, 5, 6, 7])("hides Home-only step %i on a workspace page", (step) => {
        setStep(step);
        const { getByTestId } = render(<OnboardingV2Host active workspacePage />);
        expect(getByTestId("onboarding-coach").props.pointerEvents).toBe("none");
    });
});

describe("OnboardingV2Host analytics", () => {
    test("step viewed uses the v2 step name and index", () => {
        setStep(4);
        render(<OnboardingV2Host active />);
        expect(mockCapture).toHaveBeenCalledWith(AnalyticsEvents.ONBOARDING_STEP_VIEWED, {
            step_name: "v2_rings",
            step_index: 4,
        });
    });

    test("a guest finishing v2 emits ONBOARDING_COMPLETED once", () => {
        setStep(8, true);
        const { rerender } = render(<OnboardingV2Host active />);
        setStep(9, true);
        rerender(<OnboardingV2Host active />);
        const completed = mockCapture.mock.calls.filter(([name]) => name === AnalyticsEvents.ONBOARDING_COMPLETED);
        expect(completed).toHaveLength(1);
    });

    test("a non-guest finishing v2 does not emit ONBOARDING_COMPLETED", () => {
        setStep(7, false);
        const { rerender } = render(<OnboardingV2Host active />);
        setStep(9, false);
        rerender(<OnboardingV2Host active />);
        const completed = mockCapture.mock.calls.filter(([name]) => name === AnalyticsEvents.ONBOARDING_COMPLETED);
        expect(completed).toHaveLength(0);
    });
});

jest.mock("@react-native-async-storage/async-storage", () =>
    require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

import AsyncStorage from "@react-native-async-storage/async-storage";
import { homeTourVisibilityEvents } from "@/utils/homeTourVisibilityEvents";
import {
    __resetAccountOverlayStore,
    dismissAccountOverlay,
    closeAccountOverlay,
    TASK_PROMPT_DELAY_MS,
    openAccountOverlay,
    promptAccountAfterTask,
    promptAccountForSocial,
    promptAccountAfterSkippingTutorial,
    registerAccountOverlayHost,
    setAccountOverlayEligible,
    setAccountOverlayGuest,
    useAccountOverlay,
} from "@/hooks/useAccountOverlay";
import { renderHook, act } from "@testing-library/react-native";

const guest = { _id: "g1", isGuest: true };

describe("account overlay store", () => {
    beforeEach(async () => {
        __resetAccountOverlayStore();
        await AsyncStorage.clear();
    });

    it("never opens without a mounted host", () => {
        const { result } = renderHook(() => useAccountOverlay());
        act(() => openAccountOverlay("login-link"));
        expect(result.current.visible).toBe(false);
    });

    it("opens and dismisses, running onDismiss only on dismissal", () => {
        registerAccountOverlayHost();
        const onDismiss = jest.fn();
        const { result } = renderHook(() => useAccountOverlay());
        act(() => openAccountOverlay("social", { surface: "feed", onDismiss }));
        expect(result.current.visible).toBe(true);
        expect(result.current.request?.reason).toBe("social");
        act(() => closeAccountOverlay());
        expect(onDismiss).not.toHaveBeenCalled();
        act(() => openAccountOverlay("social", { surface: "feed", onDismiss }));
        act(() => dismissAccountOverlay());
        expect(result.current.visible).toBe(false);
        expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it("prompts each social surface once per session, only for eligible guests", () => {
        registerAccountOverlayHost();
        expect(promptAccountForSocial("feed")).toBe(false);
        setAccountOverlayEligible(true);
        expect(promptAccountForSocial("feed")).toBe(true);
        act(() => dismissAccountOverlay());
        expect(promptAccountForSocial("feed")).toBe(false);
        expect(promptAccountForSocial("search")).toBe(true);
    });

    it("can prompt a surface on every visit", () => {
        registerAccountOverlayHost();
        setAccountOverlayEligible(true);
        expect(promptAccountForSocial("feed", undefined, { everyVisit: true })).toBe(true);
        act(() => dismissAccountOverlay());
        expect(promptAccountForSocial("feed", undefined, { everyVisit: true })).toBe(true);
    });

    it("opens once eligible after the tutorial is skipped", () => {
        const { result } = renderHook(() => useAccountOverlay());
        act(() => promptAccountAfterSkippingTutorial());
        expect(result.current.visible).toBe(false);
        registerAccountOverlayHost();
        act(() => setAccountOverlayEligible(true));
        expect(result.current.request?.reason).toBe("skipped-tutorial");
    });

    it("re-reads the tutorial flag when the host's view is stale", async () => {
        registerAccountOverlayHost();
        setAccountOverlayGuest("g1");
        setAccountOverlayEligible(false);
        const { result } = renderHook(() => useAccountOverlay());
        await AsyncStorage.setItem("g1-guest-tutorial-done", "true");
        expect(promptAccountForSocial("feed", undefined, { everyVisit: true })).toBe(false);
        await act(() => new Promise((r) => jest.requireActual("timers").setImmediate(r)));
        expect(result.current.request?.surface).toBe("feed");
    });

    it("waits for the home tour to finish", () => {
        registerAccountOverlayHost();
        const { result } = renderHook(() => useAccountOverlay());
        act(() => homeTourVisibilityEvents.emit(true));
        act(() => openAccountOverlay("task-limit"));
        expect(result.current.visible).toBe(false);
        act(() => homeTourVisibilityEvents.emit(false));
        expect(result.current.visible).toBe(true);
    });

    it("asks for an account from the third post-tutorial task on", async () => {
        jest.useFakeTimers();
        try {
            registerAccountOverlayHost();
            setAccountOverlayEligible(true);
            const { result } = renderHook(() => useAccountOverlay());
            const settle = () => act(() => jest.advanceTimersByTime(TASK_PROMPT_DELAY_MS));

            // The tutorial's own task: flag not set yet, so it doesn't count
            await act(() => promptAccountAfterTask(guest));
            await AsyncStorage.setItem("g1-guest-tutorial-done", "true");
            await act(() => promptAccountAfterTask(guest));
            await act(() => promptAccountAfterTask(guest));
            settle();
            expect(result.current.visible).toBe(false);

            await act(() => promptAccountAfterTask(guest));
            settle();
            expect(result.current.request?.reason).toBe("task-limit");
            expect(await AsyncStorage.getItem("g1-guest-task-count")).toBe("3");

            // Dismissed, it comes back with the next task
            act(() => dismissAccountOverlay());
            await act(() => promptAccountAfterTask(guest));
            settle();
            expect(result.current.visible).toBe(true);
        } finally {
            jest.useRealTimers();
        }
    });

    it("ignores non-guests", async () => {
        registerAccountOverlayHost();
        setAccountOverlayEligible(true);
        await AsyncStorage.setItem("u1-guest-tutorial-done", "true");
        await promptAccountAfterTask({ _id: "u1", isGuest: false });
        expect(await AsyncStorage.getItem("u1-guest-task-count")).toBeNull();
    });
});

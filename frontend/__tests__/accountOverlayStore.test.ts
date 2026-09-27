jest.mock("@react-native-async-storage/async-storage", () =>
    require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

import AsyncStorage from "@react-native-async-storage/async-storage";
import { homeTourVisibilityEvents } from "@/utils/homeTourVisibilityEvents";
import {
    __resetAccountOverlayStore,
    dismissAccountOverlay,
    closeAccountOverlay,
    FIRST_TASK_PROMPT_DELAY_MS,
    openAccountOverlay,
    promptAccountAfterFirstTask,
    promptAccountForSocial,
    registerAccountOverlayHost,
    setAccountOverlayEligible,
    useAccountOverlay,
} from "@/hooks/useAccountOverlay";
import { renderHook, act } from "@testing-library/react-native";

const guest = { _id: "g1", isGuest: true };
const flush = () => new Promise((r) => jest.requireActual("timers").setImmediate(r));

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

    it("waits for the home tour to finish", () => {
        registerAccountOverlayHost();
        const { result } = renderHook(() => useAccountOverlay());
        act(() => homeTourVisibilityEvents.emit(true));
        act(() => openAccountOverlay("first-task"));
        expect(result.current.visible).toBe(false);
        act(() => homeTourVisibilityEvents.emit(false));
        expect(result.current.visible).toBe(true);
    });

    it("prompts after the first task only once the tutorial is done, and only once", async () => {
        jest.useFakeTimers();
        try {
            registerAccountOverlayHost();
            setAccountOverlayEligible(true);
            const { result } = renderHook(() => useAccountOverlay());

            // The tutorial's own task: flag not set yet
            await act(() => promptAccountAfterFirstTask(guest));
            act(() => jest.advanceTimersByTime(FIRST_TASK_PROMPT_DELAY_MS));
            expect(result.current.visible).toBe(false);

            await AsyncStorage.setItem("g1-guest-tutorial-done", "true");
            await act(() => promptAccountAfterFirstTask(guest));
            expect(result.current.visible).toBe(false);
            act(() => jest.advanceTimersByTime(FIRST_TASK_PROMPT_DELAY_MS));
            expect(result.current.visible).toBe(true);
            expect(result.current.request?.reason).toBe("first-task");
            await act(flush);
            expect(await AsyncStorage.getItem("g1-account-prompt-first-task")).toBe("true");

            act(() => dismissAccountOverlay());
            act(() => __resetAccountOverlayStore());
            registerAccountOverlayHost();
            setAccountOverlayEligible(true);
            await act(() => promptAccountAfterFirstTask(guest));
            act(() => jest.advanceTimersByTime(FIRST_TASK_PROMPT_DELAY_MS));
            expect(result.current.visible).toBe(false);
        } finally {
            jest.useRealTimers();
        }
    });

    it("ignores non-guests", async () => {
        registerAccountOverlayHost();
        setAccountOverlayEligible(true);
        await AsyncStorage.setItem("u1-guest-tutorial-done", "true");
        await promptAccountAfterFirstTask({ _id: "u1", isGuest: false });
        expect(await AsyncStorage.getItem("u1-account-prompt-first-task")).toBeNull();
    });
});

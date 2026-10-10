import { act, renderHook, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useOnboardingV2 } from "@/hooks/useOnboardingV2";

jest.mock("@react-native-async-storage/async-storage", () =>
    require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

let mockGuest = true;
jest.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { _id: "u1" } }) }));
jest.mock("@/hooks/useIsGuest", () => ({ useIsGuest: () => mockGuest }));

const STEP_KEY = "u1-onboarding-v2-step";
const QUICK_SETUP_KEY = "u1-quicksetup";
const GUEST_DONE_KEY = "u1-guest-tutorial-done";

const render = (opts: { hasNoWorkspaces?: boolean } = {}) =>
    renderHook(() => useOnboardingV2({ hasNoWorkspaces: opts.hasNoWorkspaces ?? false, ready: true }));

beforeEach(async () => {
    mockGuest = true;
    await AsyncStorage.clear();
    jest.restoreAllMocks();
    jest.spyOn(console, "warn").mockImplementation(() => {});
});

describe("onboarding v2 completion persistence", () => {
    it("a guest who finishes writes done, quick-setup, and the guest tutorial flag", async () => {
        await AsyncStorage.setItem(STEP_KEY, "8");
        const { result } = render();
        await waitFor(() => expect(result.current.step).toBe(8));

        act(() => result.current.dispatch({ type: "ACCOUNT_PROMPT_DONE" }));

        await waitFor(() => expect(result.current.step).toBe(9));
        expect(await AsyncStorage.getItem(STEP_KEY)).toBe("9");
        expect(await AsyncStorage.getItem(QUICK_SETUP_KEY)).toBe("true");
        expect(await AsyncStorage.getItem(GUEST_DONE_KEY)).toBe("true");
    });

    it("a guest who skips marks the guest tutorial flag", async () => {
        await AsyncStorage.setItem(STEP_KEY, "2");
        const { result } = render();
        await waitFor(() => expect(result.current.step).toBe(2));

        act(() => result.current.dispatch({ type: "SKIP" }));

        await waitFor(() => expect(result.current.step).toBe(9));
        expect(await AsyncStorage.getItem(GUEST_DONE_KEY)).toBe("true");
        expect(await AsyncStorage.getItem(QUICK_SETUP_KEY)).toBe("true");
    });

    it("a non-guest who skips writes quick-setup but not the guest flag", async () => {
        mockGuest = false;
        await AsyncStorage.setItem(STEP_KEY, "3");
        const { result } = render();
        await waitFor(() => expect(result.current.step).toBe(3));

        act(() => result.current.dispatch({ type: "SKIP" }));

        await waitFor(() => expect(result.current.step).toBe(9));
        expect(await AsyncStorage.getItem(QUICK_SETUP_KEY)).toBe("true");
        expect(await AsyncStorage.getItem(GUEST_DONE_KEY)).toBeNull();
    });

    it("loading an already-done user does not write quick-setup", async () => {
        mockGuest = false;
        await AsyncStorage.setItem(STEP_KEY, "9");
        const { result } = render();
        await waitFor(() => expect(result.current.step).toBe(9));
        expect(await AsyncStorage.getItem(QUICK_SETUP_KEY)).toBeNull();
    });

    it("backfills the guest flag for a guest already stored as done", async () => {
        await AsyncStorage.setItem(STEP_KEY, "9");
        const { result } = render();
        await waitFor(() => expect(result.current.step).toBe(9));
        await waitFor(async () => expect(await AsyncStorage.getItem(GUEST_DONE_KEY)).toBe("true"));
    });
});

describe("onboarding v2 load failure", () => {
    it("falls back to done when storage throws, so nothing blocks", async () => {
        jest.spyOn(AsyncStorage, "getItem").mockRejectedValue(new Error("disk full"));
        const { result } = render();

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.step).toBe(9);
        expect(console.warn).toHaveBeenCalled();
    });
});

import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/hooks/useAuth";
import { useFocusMode } from "@/contexts/focusModeContext";

// Full-screen, gesture-driven first-touch tour: teaches the pager swipe
// (right → workspaces, left → calendar/list), the home button, then chains
// into a one-step intro for focus mode. Separate from useHomeTour (the
// scroll-guided dashboard reveal) since it spans pages instead of sections
// and needs real swipes, not taps, to advance.

export type IntroStep = "swipeRight" | "swipeLeft" | "homeButton" | "focusMode";
const STEPS: IntroStep[] = ["swipeRight", "swipeLeft", "homeButton", "focusMode"];
const START_DELAY_MS = 900;

type Args = {
    activeIndex: number;
    homeIndex: number;
    todayIndex: number;
    setSelected: (s: string) => void;
    // Scroll-tour running, or a workspace-setup sheet covering the screen —
    // don't start (or restart the delay) until this clears.
    blocked: boolean;
};

export function useIntroTour({ activeIndex, homeIndex, todayIndex, setSelected, blocked }: Args) {
    const { user } = useAuth();
    const { toggleFocusMode } = useFocusMode();
    const seenKey = user?._id ? `${user._id}-intro-tour-seen` : null;

    const [active, setActive] = useState(false);
    const [stepIndex, setStepIndex] = useState(0);
    // Whether we've confirmed (via AsyncStorage) that this user hasn't seen
    // the tour yet — state, not a ref, so resolving it re-triggers scheduling.
    const [unseen, setUnseen] = useState(false);

    const checked = useRef(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const finish = useCallback(() => {
        setActive(false);
        setStepIndex(0);
        setUnseen(false);
        if (seenKey) AsyncStorage.setItem(seenKey, "true").catch(() => {});
    }, [seenKey]);

    // Check once per user whether they've seen it.
    useEffect(() => {
        if (!seenKey || checked.current) return;
        checked.current = true;
        AsyncStorage.getItem(seenKey)
            .then((v) => {
                if (v == null) setUnseen(true);
            })
            .catch(() => {});
    }, [seenKey]);

    // (Re)schedule the delayed start whenever the blocker clears. Restarts
    // the wait — rather than requiring a specific "workspace created" event —
    // so it naturally waits out the quick-setup sheet whether the user
    // creates a workspace inside it or skips.
    useEffect(() => {
        clearTimeout(timer.current ?? undefined);
        if (blocked || active || !unseen) return;
        timer.current = setTimeout(() => {
            setSelected("");
            setStepIndex(0);
            setActive(true);
        }, START_DELAY_MS);
        return () => clearTimeout(timer.current ?? undefined);
    }, [blocked, active, unseen, setSelected]);

    // Real pager movement advances the swipe steps.
    useEffect(() => {
        if (!active) return;
        const step = STEPS[stepIndex];
        if (step === "swipeRight" && activeIndex > homeIndex) {
            setSelected("");
            setStepIndex(1);
        } else if (step === "swipeLeft" && activeIndex === todayIndex) {
            setStepIndex(2);
        }
    }, [active, activeIndex, stepIndex, homeIndex, todayIndex, setSelected]);

    const onHomeButtonPress = useCallback(() => {
        setSelected("");
        setStepIndex(3);
    }, [setSelected]);

    const onFocusModePress = useCallback(() => {
        toggleFocusMode();
        finish();
    }, [toggleFocusMode, finish]);

    const skip = useCallback(() => finish(), [finish]);

    return {
        active,
        step: active ? STEPS[stepIndex] : null,
        stepIndex,
        totalSteps: STEPS.length,
        onHomeButtonPress,
        onFocusModePress,
        skip,
    };
}

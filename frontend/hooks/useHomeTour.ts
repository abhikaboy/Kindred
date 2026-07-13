import { useCallback, useEffect, useRef, useState } from "react";
import { Dimensions, ScrollView, View, NativeSyntheticEvent, NativeScrollEvent } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/hooks/useAuth";

// First-touch guided reveal of the home dashboard. Sections mount one at a time
// (see HomeScrollContent gating); this hook owns step state + auto-scroll.

export type TourKey = "rings" | "jumpBackIn" | "upcoming" | "workspaces" | "create";

export const HOME_TOUR_STEPS: { key: TourKey; copy: string }[] = [
    { key: "rings", copy: "Close all three rings every day to keep your momentum going." },
    { key: "jumpBackIn", copy: "Your recent tasks live here — tap one to pick up where you left off." },
    { key: "upcoming", copy: "Everything due soon, at a glance." },
    { key: "workspaces", copy: "Workspaces keep the parts of your life separate." },
    { key: "create", copy: "Let's set up your Kindred." },
];

// Section keys that map to a real on-screen section (the create step is card-only).
const SECTION_ORDER: TourKey[] = ["rings", "jumpBackIn", "upcoming", "workspaces"];

// Where the active section's top should land on screen after auto-scroll.
const TARGET_TOP = Dimensions.get("window").height * 0.34;

export function useHomeTour(scrollRef?: React.RefObject<ScrollView>) {
    const { user } = useAuth();
    const seenKey = user?._id ? `${user._id}-home-tour-seen` : null;

    const [active, setActive] = useState(false);
    const [stepIndex, setStepIndex] = useState(0);
    const [activeSectionTop, setActiveSectionTop] = useState<number | null>(null);

    const nodes = useRef(new Map<TourKey, View>());
    const scrollY = useRef(0);
    const autoChecked = useRef(false);

    const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
        scrollY.current = e.nativeEvent.contentOffset.y;
    }, []);

    const registerSection = useCallback((key: TourKey, node: View | null) => {
        if (node) nodes.current.set(key, node);
        else nodes.current.delete(key);
    }, []);

    const finish = useCallback(() => {
        setActive(false);
        setStepIndex(0);
        setActiveSectionTop(null);
        if (seenKey) AsyncStorage.setItem(seenKey, "true").catch(() => {});
    }, [seenKey]);

    const start = useCallback(() => {
        scrollRef?.current?.scrollTo({ y: 0, animated: false });
        setActiveSectionTop(null);
        setStepIndex(0);
        setActive(true);
    }, [scrollRef]);

    const next = useCallback(() => {
        setStepIndex((i) => i + 1);
    }, []);

    const skip = useCallback(() => finish(), [finish]);

    // Advancing past the last step ends the tour.
    useEffect(() => {
        if (active && stepIndex >= HOME_TOUR_STEPS.length) finish();
    }, [active, stepIndex, finish]);

    // Auto-start once per user on the first home visit.
    useEffect(() => {
        if (!seenKey || autoChecked.current) return;
        autoChecked.current = true;
        AsyncStorage.getItem(seenKey)
            .then((v) => {
                if (v == null) setTimeout(() => start(), 600);
            })
            .catch(() => {});
    }, [seenKey, start]);

    // On each step: scroll the active section into the clear zone, then measure
    // its screen top so the blur band can sit just above it. Absent/empty
    // sections (brand-new user with no tasks) auto-skip.
    useEffect(() => {
        if (!active) return;
        const step = HOME_TOUR_STEPS[stepIndex];
        if (!step) return;
        if (step.key === "create") {
            setActiveSectionTop(null);
            return;
        }
        let cancelled = false;
        // Retry a few times before giving up — a freshly-revealed section may not
        // be laid out yet, and skipping too eagerly cascades to the create step.
        const run = (attempt: number) => {
            if (cancelled) return;
            const node = nodes.current.get(step.key);
            if (!node) {
                if (attempt < 3) setTimeout(() => run(attempt + 1), 150);
                else next();
                return;
            }
            node.measureInWindow((_x, wy, _w, h) => {
                if (cancelled) return;
                if (h < 8) {
                    if (attempt < 3) setTimeout(() => run(attempt + 1), 150);
                    else next();
                    return;
                }
                scrollRef?.current?.scrollTo({ y: Math.max(0, scrollY.current + wy - TARGET_TOP), animated: true });
                setTimeout(() => {
                    if (cancelled) return;
                    node.measureInWindow((_x2, wy2) => {
                        if (!cancelled) setActiveSectionTop(Math.max(wy2, 0));
                    });
                }, 400);
            });
        };
        const t = setTimeout(() => run(0), 100);
        return () => {
            cancelled = true;
            clearTimeout(t);
        };
    }, [active, stepIndex, next, scrollRef]);

    const visibleUpTo = useCallback(
        (key: TourKey) => {
            if (!active) return true;
            const idx = SECTION_ORDER.indexOf(key);
            return idx <= stepIndex;
        },
        [active, stepIndex]
    );

    const step = HOME_TOUR_STEPS[stepIndex] ?? null;

    return {
        active,
        stepIndex,
        step,
        isCreateStep: step?.key === "create",
        totalSteps: HOME_TOUR_STEPS.length,
        start,
        next,
        skip,
        visibleUpTo,
        registerSection,
        onScroll,
        activeSectionTop,
    };
}

export type HomeTour = ReturnType<typeof useHomeTour>;

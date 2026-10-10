import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Animated, Easing, Keyboard, Platform, StyleSheet, useWindowDimensions, View } from "react-native";
import { useCoachScrolling } from "@/utils/onboardingV2/coachScroll";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CoachCard } from "@/components/onboarding/CoachCard";
import CoachBackdrop from "@/components/onboarding/CoachBackdrop";
import CoachSwipeArrow, { SWIPE_ARROW_SIZE } from "@/components/onboarding/CoachSwipeArrow";
import CoachSpotlight from "@/components/onboarding/CoachSpotlight";
import { useOnboardingV2Context } from "@/contexts/OnboardingV2Context";
import { useTasks } from "@/contexts/tasksContext";
import { createWorkspace } from "@/api/workspace";
import { ONBOARDING_WORKSPACE } from "@/constants/spotlightConfig";
import { useAnalytics } from "@/hooks/useAnalytics";
import { openAccountOverlay, useAccountOverlay } from "@/hooks/useAccountOverlay";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { AnalyticsEvents } from "@/utils/analytics";
import {
    ONBOARDING_V2_DONE,
    OnboardingV2Event,
    OnboardingV2Step,
    stepKey,
} from "@/utils/onboardingV2/machine";
import { layoutCoach } from "@/utils/onboardingV2/coachLayout";
import { COACH_LAYER } from "@/utils/onboardingV2/coachLayers";
import { useCoachSurface } from "@/utils/onboardingV2/coachSurface";
import type { Rect } from "@/utils/onboardingV2/spotlightRects";
import { registerGuideCreator } from "@/utils/onboardingV2/guideCreator";
import { phaseDots } from "@/utils/onboardingV2/progress";
import { getCoachAnchorFrame, subscribeCoachAnchors, type CoachAnchorKey } from "@/utils/onboardingV2/coachAnchors";
import { RING_COLORS } from "@shared/rings";
import { COMPLETE_TASK_CONTENT, GO_HOME_CONTENT, STEP_CONTENT, type CoachStepKey } from "@/utils/onboardingV2/stepContent";
import { setCoachRing } from "@/utils/onboardingV2/coachRing";
import { guideFacts } from "@/utils/onboardingV2/guideFacts";

const ACCOUNT_STEP: OnboardingV2Step = 8;
// Lets the score count-up play before the account prompt covers Home.
const ACCOUNT_PROMPT_DELAY_MS = 2600;
const COACH_GAP = 12;
// Card height before layout runs: without and with a body line.
const CARD_HEIGHT_PLAIN = 110;
const CARD_HEIGHT_WITH_BODY = 140;
const ANCHOR_POLL_MS = 500;
// Reveal after creating the workspace: clear for a few seconds, then the blur fades in, then the card.
const NEW_WORKSPACE_HOLD_MS = 3000;
const NEW_WORKSPACE_BLUR_MS = 900;
// Step 7 finishes on its own if the user never completes a task.
const FINISH_STEP = 7;
const FINISH_AFTER_MS = 6000;

// Steps whose card has a tap action.
const ACTION_EVENT: Partial<Record<OnboardingV2Step, OnboardingV2Event>> = {
    4: { type: "RINGS_CONTINUE" },
    5: { type: "RING_DETAIL_CONTINUE" },
    7: { type: "FINISH" },
};

const TARGET_KEY: Record<string, CoachAnchorKey> = {
    swipeZone: "workspacesHandle",
    workspaceCreate: "workspaceCreate",
    categoryAdd: "categoryAdd",
    taskAdd: "taskAdd",
    firstTask: "firstTask",
    homeTab: "homeTab",
    rings: "rings",
    dock: "dock",
};

const sameFrame = (a: Rect | null, b: Rect | null) =>
    a === b || (!!a && !!b && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height);

type Props = {
    /** False while Home or a workspace page is not visible, or the scripted home tour is running. */
    active: boolean;
    /** True on a workspace page: only steps 1-3 show there. Home-only steps stay on Home. */
    workspacePage?: boolean;
};

/** Mounted once above the tabs; follows the surface the task tab publishes. */
export function OnboardingV2Overlay() {
    const { active, workspacePage } = useCoachSurface();
    return <OnboardingV2Host active={active} workspacePage={workspacePage} />;
}

/** Full-window coach overlay: blur around the target, a cue and the card, all laid out in window coordinates. */
export default function OnboardingV2Host({ active, workspacePage = false }: Props) {
    const { step, isGuest, dispatch } = useOnboardingV2Context();
    const { addWorkspace, doesWorkspaceExist, setSelected, workspaces } = useTasks();
    const creatingRef = useRef(false);
    const { capture } = useAnalytics();
    const insets = useSafeAreaInsets();
    const window = useWindowDimensions();
    const account = useAccountOverlay();
    const [ringIndex, setRingIndex] = useState(0);
    const [measuredHeight, setCoachHeight] = useState<number | null>(null);
    const [anchorFrame, setAnchorFrame] = useState<Rect | null>(null);
    const [origin, setOrigin] = useState({ x: 0, y: 0 });
    const rootRef = useRef<View>(null);
    const [keyboardTop, setKeyboardTop] = useState<number | null>(null);
    const skippingRef = useRef(false);
    const prevStepRef = useRef<OnboardingV2Step | null>(null);
    const askedRef = useRef(false);
    const sawAccountRef = useRef(false);
    const accountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => () => { if (accountTimerRef.current) clearTimeout(accountTimerRef.current); }, []);

    useEffect(() => {
        const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
        const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
        const show = Keyboard.addListener(showEvent, (e) => setKeyboardTop(e.endCoordinates.screenY));
        const hide = Keyboard.addListener(hideEvent, () => setKeyboardTop(null));
        return () => {
            show.remove();
            hide.remove();
        };
    }, []);

    // Finishes step 7 without a task completion. Completing a task dispatches FINISH too (SwipableTaskCard).
    useEffect(() => {
        if (step !== FINISH_STEP) return;
        const timer = setTimeout(() => dispatch({ type: "FINISH" }), FINISH_AFTER_MS);
        return () => clearTimeout(timer);
    }, [step, dispatch]);

    useEffect(() => {
        if (step === null || step === ONBOARDING_V2_DONE) return;
        capture(AnalyticsEvents.ONBOARDING_STEP_VIEWED, { step_name: `v2_${stepKey(step)}`, step_index: step });
        setRingIndex(0);
    }, [step, capture]);

    useEffect(() => {
        if (step === null) return;
        const prev = prevStepRef.current;
        prevStepRef.current = step;
        if (prev === null || step <= prev) return;
        if (step === ONBOARDING_V2_DONE) {
            if (skippingRef.current) {
                capture(AnalyticsEvents.ONBOARDING_ABANDONED, { skipped_at_step: prev });
                return;
            }
            capture(AnalyticsEvents.ONBOARDING_STEP_COMPLETED, { step_name: `v2_${stepKey(prev)}`, step_index: prev });
            // Account signups emit ONBOARDING_COMPLETED from the calendar screen, so only guests fire it here.
            if (isGuest) capture(AnalyticsEvents.ONBOARDING_COMPLETED);
            return;
        }
        capture(AnalyticsEvents.ONBOARDING_STEP_COMPLETED, { step_name: `v2_${stepKey(prev)}`, step_index: prev });
    }, [step, isGuest, capture]);

    // Step 8: the account prompt replaces the coach. It advances on sign-up (no longer a guest) or dismissal.
    useEffect(() => {
        if (step !== ACCOUNT_STEP) {
            askedRef.current = false;
            sawAccountRef.current = false;
            if (accountTimerRef.current) clearTimeout(accountTimerRef.current);
            return;
        }
        if (!isGuest) {
            dispatch({ type: "ACCOUNT_PROMPT_DONE" });
            return;
        }
        if (!askedRef.current) {
            askedRef.current = true;
            accountTimerRef.current = setTimeout(() => openAccountOverlay("skipped-tutorial"), ACCOUNT_PROMPT_DELAY_MS);
        }
    }, [step, isGuest, dispatch]);

    useEffect(() => {
        if (step !== ACCOUNT_STEP || !isGuest) return;
        if (account.visible) {
            sawAccountRef.current = true;
        } else if (sawAccountRef.current) {
            sawAccountRef.current = false;
            dispatch({ type: "ACCOUNT_PROMPT_DONE" });
        }
    }, [step, isGuest, account.visible, dispatch]);

    const stepShownHere = !workspacePage || (step !== null && step >= 1 && step <= 4);
    const coachStep = step !== null && step !== ONBOARDING_V2_DONE && step !== ACCOUNT_STEP && stepShownHere ? step : null;
    const baseVisible = active && coachStep !== null;
    // Step 3 has two halves, told apart by the guide itself: no category yet asks for one, a task asks for the swipe.
    const facts = coachStep === 3 ? guideFacts(workspaces ?? []) : null;
    const contentStep = (coachStep === 3 && facts && !facts.hasCategoryInGuide ? 2 : coachStep) as CoachStepKey | null;
    const content =
        coachStep === 4 && workspacePage
            ? GO_HOME_CONTENT
            : coachStep === 3 && facts?.hasTaskInGuide
            ? COMPLETE_TASK_CONTENT
            : contentStep !== null && contentStep !== (ACCOUNT_STEP as number)
              ? STEP_CONTENT[contentStep]
              : null;
    const isRingStep = coachStep === 5 && !workspacePage;
    const lastRing = ringIndex >= (content?.subSteps?.length ?? 1) - 1;
    const shown = isRingStep && content?.subSteps ? content.subSteps[ringIndex] : content;
    const actionLabel = content?.actionLabel;
    // Step 5 spotlights one ring at a time: the rings card dims the other two.
    const spotlitRing = isRingStep && baseVisible ? (content?.subSteps?.[ringIndex]?.ring ?? null) : null;
    useEffect(() => {
        setCoachRing(spotlitRing);
        return () => setCoachRing(null);
    }, [spotlitRing]);
    const coachHeight = measuredHeight ?? (shown?.body ? CARD_HEIGHT_WITH_BODY : CARD_HEIGHT_PLAIN);
    const registryKey = content?.target ? TARGET_KEY[content.target] : null;

    // Targets live in other screens, so poll their registered refs.
    useEffect(() => {
        setAnchorFrame(null);
        if (!baseVisible || !registryKey) return;
        let alive = true;
        const measure = () => {
            void getCoachAnchorFrame(registryKey).then((f) => {
                if (alive) setAnchorFrame((prev) => (sameFrame(prev, f) ? prev : f));
            });
        };
        measure();
        const unsubscribe = subscribeCoachAnchors(measure);
        const timer = setInterval(measure, ANCHOR_POLL_MS);
        return () => {
            alive = false;
            unsubscribe();
            clearInterval(timer);
        };
    }, [baseVisible, registryKey]);

    const targetFrame = registryKey ? anchorFrame : null;
    const blurMode = content?.blur ?? "none";
    const cue = content?.cue ?? null;
    const layout = layoutCoach({
        window: { x: 0, y: 0, width: window.width, height: window.height },
        safeArea: { top: insets.top, bottom: insets.bottom },
        keyboardTop,
        target: targetFrame,
        cardSize: { width: window.width - 2 * HORIZONTAL_PADDING, height: coachHeight },
        cue: { kind: cue, size: SWIPE_ARROW_SIZE },
        gap: COACH_GAP,
    });
    // Step 1 points at the real "+": without it on screen there is nothing to show.
    const visible = baseVisible && (content?.target !== "workspaceCreate" || layout.sharp !== null);
    // The spotlight and cue hide while the page scrolls, instead of trailing a stale frame.
    const scrolling = useCoachScrolling();
    // Right after the workspace is created the page stays clear for a few seconds, then the blur
    // eases in, then the card, so the new workspace is seen before it is explained.
    const [reveal, setReveal] = useState<"all" | "held" | "blur">("all");
    const lastRevealStep = useRef<OnboardingV2Step | null>(null);
    useLayoutEffect(() => {
        const prev = lastRevealStep.current;
        lastRevealStep.current = step;
        if (step !== 2 || prev !== 1) {
            setReveal("all");
            return;
        }
        setReveal("held");
        const toBlur = setTimeout(() => setReveal("blur"), NEW_WORKSPACE_HOLD_MS);
        const toAll = setTimeout(() => setReveal("all"), NEW_WORKSPACE_HOLD_MS + NEW_WORKSPACE_BLUR_MS);
        return () => {
            clearTimeout(toBlur);
            clearTimeout(toAll);
        };
    }, [step]);
    const targetVisible = visible && !scrolling && reveal !== "held";
    const cardVisible = visible && reveal === "all";
    const local = (r: Rect): Rect => ({ x: r.x - origin.x, y: r.y - origin.y, width: r.width, height: r.height });
    const card = local(layout.card);

    // When the card's target moves, it glides from where it was instead of jumping.
    const slotOffset = useRef(new Animated.Value(0)).current;
    const lastCardY = useRef<number | null>(null);
    useEffect(() => {
        const prev = lastCardY.current;
        lastCardY.current = card.y;
        if (prev === null || prev === card.y || !visible) return;
        slotOffset.setValue(prev - card.y);
        Animated.timing(slotOffset, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }, [card.y, visible, slotOffset]);

    const onSkip = () => {
        skippingRef.current = true;
        dispatch({ type: "SKIP" });
    };

    // One tap creates the guide, selects it, and completes step 1. Re-selects it if it already exists.
    const createGuide = async () => {
        if (creatingRef.current) return;
        if (doesWorkspaceExist(ONBOARDING_WORKSPACE)) {
            setSelected(ONBOARDING_WORKSPACE);
            dispatch({ type: "OPEN_GUIDE" });
            return;
        }
        creatingRef.current = true;
        try {
            const category = await createWorkspace(ONBOARDING_WORKSPACE);
            addWorkspace(ONBOARDING_WORKSPACE, category);
            setSelected(ONBOARDING_WORKSPACE);
            dispatch({ type: "OPEN_GUIDE" });
        } catch (error) {
            // createWorkspace shows its own toast. Step 1 stays put so the next tap retries.
            console.warn("[onboarding] creating the first workspace failed", error);
        } finally {
            creatingRef.current = false;
        }
    };

    // While step 1 is current, the real "+" in the Workspaces header creates the guide.
    const createGuideRef = useRef(createGuide);
    createGuideRef.current = createGuide;
    useEffect(() => {
        if (step !== 1) return;
        return registerGuideCreator(() => void createGuideRef.current());
    }, [step]);

    const onAction = () => {
        if (isRingStep && !lastRing) {
            setRingIndex((i) => i + 1);
            return;
        }
        const event = coachStep !== null ? ACTION_EVENT[coachStep] : undefined;
        if (event) dispatch(event);
    };

    return (
        <View
            ref={rootRef}
            pointerEvents="box-none"
            style={StyleSheet.absoluteFill}
            onLayout={() => rootRef.current?.measureInWindow?.((x, y) => setOrigin({ x, y }))}>
            {blurMode === "target" && (
                <View pointerEvents="none" style={styles.layer}>
                    <CoachSpotlight frame={layout.sharp} active={targetVisible} coverUntilFrame={!!registryKey} fadeMs={reveal === "blur" ? NEW_WORKSPACE_BLUR_MS : 200} />
                </View>
            )}
            {blurMode === "all" && (
                <View pointerEvents="none" style={styles.layer}>
                    <CoachBackdrop active={visible} />
                </View>
            )}
            {targetVisible && cue && layout.cue && (
                <View
                    pointerEvents="none"
                    style={[styles.cue, { left: local(layout.cue).x, top: local(layout.cue).y, width: layout.cue.width, height: layout.cue.height }]}>
                    <CoachSwipeArrow direction={cue} />
                </View>
            )}
            <Animated.View
                pointerEvents="box-none"
                testID="onboarding-coach-slot"
                onLayout={(e) => setCoachHeight(e.nativeEvent.layout.height)}
                style={[styles.slot, { left: card.x, top: card.y, width: card.width, transform: [{ translateY: slotOffset }] }]}>
                <CoachCard
                    title={shown?.title ?? ""}
                    body={shown?.body}
                    accentColor={isRingStep && content?.subSteps ? RING_COLORS[content.subSteps[ringIndex].ring] : undefined}
                    step={coachStep !== null ? phaseDots(coachStep) ?? undefined : undefined}
                    actionLabel={actionLabel}
                    onAction={actionLabel ? onAction : undefined}
                    onSkip={onSkip}
                    visible={cardVisible}
                />
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    layer: {
        ...StyleSheet.absoluteFillObject,
        zIndex: COACH_LAYER.BLUR,
    },
    cue: {
        position: "absolute",
        zIndex: COACH_LAYER.CUE,
    },
    slot: {
        position: "absolute",
        zIndex: COACH_LAYER.CARD,
    },
});

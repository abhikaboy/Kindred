import React, { useEffect, useState } from "react";
import { Keyboard, Platform, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CoachBackdrop from "@/components/onboarding/CoachBackdrop";
import { CoachCard } from "@/components/onboarding/CoachCard";
import CoachSpotlight from "@/components/onboarding/CoachSpotlight";
import CoachSwipeArrow, { SWIPE_ARROW_SIZE } from "@/components/onboarding/CoachSwipeArrow";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { usePostingLesson } from "@/contexts/PostingLessonContext";
import { useIsGuest } from "@/hooks/useIsGuest";
import { getCoachAnchorFrame, subscribeCoachAnchors, type CoachAnchorKey } from "@/utils/onboardingV2/coachAnchors";
import { layoutCoach } from "@/utils/onboardingV2/coachLayout";
import { COACH_LAYER } from "@/utils/onboardingV2/coachLayers";
import type { Rect } from "@/utils/onboardingV2/spotlightRects";
import type { LessonStep } from "@/utils/postingLesson/machine";

const COACH_GAP = 12;
const CARD_HEIGHT_ESTIMATE = 140;
const ANCHOR_POLL_MS = 500;
// The lesson toast sits at the top; the card goes just below it
const TOAST_CLEARANCE = 140;

type ScreenStep = Exclude<LessonStep, "toast">;
type StepContent = { anchor: CoachAnchorKey; title: string; body: string; cue: "up" | "down" | null; actionLabel?: string };

const SCREEN_STEPS = (isGuest: boolean): Record<ScreenStep, StepContent> => ({
    camera: {
        anchor: "postShutter",
        title: "Snap a photo of your win",
        body: "Or pick one from your library. You can skip the photo too.",
        cue: "down",
    },
    caption: {
        anchor: "postCaption",
        title: "Say a few words",
        body: "Add a caption. You can also tag friends and pick who sees it.",
        cue: null,
        actionLabel: "Next",
    },
    post: {
        anchor: "postButton",
        title: "Share it",
        body: isGuest ? "Tap Post. You'll make an account first so your friends can see it." : "Tap Post to share this with your friends.",
        cue: "down",
    },
});

/**
 * The posting lesson's overlay, mounted above the stack so it follows the user from Home into the posting
 * screens. On the toast step it blurs everything beneath the (higher) toast layer; on the screen steps it
 * spotlights the control to use next.
 */
export function PostingLessonOverlay() {
    const { step, skip, advance } = usePostingLesson();
    const isGuest = useIsGuest();
    if (!step) return null;
    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none" testID="posting-lesson">
            {step === "toast" ? (
                <ToastStep onSkip={skip} />
            ) : (
                <ScreenStepView content={SCREEN_STEPS(isGuest)[step]} onSkip={skip} onAction={step === "caption" ? () => advance("post") : undefined} />
            )}
        </View>
    );
}

function ToastStep({ onSkip }: { onSkip: () => void }) {
    const insets = useSafeAreaInsets();
    const cardTop = insets.top + TOAST_CLEARANCE;
    return (
        <>
            <View pointerEvents="none" style={[styles.layer, { zIndex: COACH_LAYER.BLUR }]}>
                <CoachBackdrop active />
            </View>
            {/* Everything but the toast is out of reach: tapping the dimmed screen just dismisses the lesson */}
            <Pressable style={StyleSheet.absoluteFill} onPress={onSkip} accessibilityLabel="Dismiss" testID="posting-lesson-scrim" />
            <View
                pointerEvents="none"
                style={[styles.cue, { top: cardTop - SWIPE_ARROW_SIZE.height - 6, left: 0, right: 0, zIndex: COACH_LAYER.CUE }]}>
                <CoachSwipeArrow direction="up" />
            </View>
            <View style={[styles.slot, { top: cardTop, left: HORIZONTAL_PADDING, right: HORIZONTAL_PADDING }]}>
                <CoachCard
                    title="Share your win"
                    body="Posting is how your friends send you kudos after you finish something. Tap the toast above to post."
                    onSkip={onSkip}
                    visible
                    testID="posting-lesson-card"
                />
            </View>
        </>
    );
}

function ScreenStepView({ content, onSkip, onAction }: { content: StepContent; onSkip: () => void; onAction?: () => void }) {
    const insets = useSafeAreaInsets();
    const window = useWindowDimensions();
    const [frame, setFrame] = useState<Rect | null>(null);
    const [keyboardTop, setKeyboardTop] = useState<number | null>(null);
    const [cardHeight, setCardHeight] = useState<number | null>(null);

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

    // The target lives on another screen, so poll its registered ref
    useEffect(() => {
        setFrame(null);
        let alive = true;
        const measure = () => {
            void getCoachAnchorFrame(content.anchor).then((f) => {
                if (alive) setFrame((prev) => (prev && f && prev.x === f.x && prev.y === f.y && prev.width === f.width && prev.height === f.height ? prev : f));
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
    }, [content.anchor]);

    const layout = layoutCoach({
        window: { x: 0, y: 0, width: window.width, height: window.height },
        safeArea: { top: insets.top, bottom: insets.bottom },
        keyboardTop,
        target: frame,
        cardSize: { width: window.width - 2 * HORIZONTAL_PADDING, height: cardHeight ?? CARD_HEIGHT_ESTIMATE },
        cue: { kind: content.cue, size: SWIPE_ARROW_SIZE },
        gap: COACH_GAP,
    });

    return (
        <>
            <View pointerEvents="none" style={[styles.layer, { zIndex: COACH_LAYER.BLUR }]}>
                <CoachSpotlight frame={layout.sharp} active coverUntilFrame testID="posting-lesson-spotlight" />
            </View>
            {content.cue && layout.cue && (
                <View
                    pointerEvents="none"
                    style={[styles.cueAbs, { left: layout.cue.x, top: layout.cue.y, width: layout.cue.width, height: layout.cue.height }]}>
                    <CoachSwipeArrow direction={content.cue} />
                </View>
            )}
            <View
                pointerEvents="box-none"
                onLayout={(e) => setCardHeight(e.nativeEvent.layout.height)}
                style={[styles.slot, { left: layout.card.x, top: layout.card.y, width: layout.card.width }]}>
                <CoachCard
                    title={content.title}
                    body={content.body}
                    actionLabel={content.actionLabel}
                    onAction={onAction}
                    onSkip={onSkip}
                    visible
                    testID="posting-lesson-card"
                />
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    layer: { ...StyleSheet.absoluteFillObject },
    cue: { position: "absolute", alignItems: "center" },
    cueAbs: { position: "absolute", zIndex: COACH_LAYER.CUE },
    slot: { position: "absolute", zIndex: COACH_LAYER.CARD },
});

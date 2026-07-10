import {
    Dimensions,
    Image,
    StyleSheet,
    View,
    ScrollView,
    Animated,
    Easing,
    Platform,
    TouchableOpacity,
    KeyboardAvoidingView,
} from "react-native";

// Shared smoothing curve so cursors glide between spots instead of jumping.
const CURSOR_EASE = Easing.inOut(Easing.cubic);
import React, { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Confetti from "@/components/ui/Confetti";
import { BlurView } from "expo-blur";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import OnboardingProgressBar from "@/components/onboarding/OnboardingProgressBar";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useAnalytics } from "@/hooks/useAnalytics";
import { AnalyticsEvents, OnboardingSteps } from "@/utils/analytics";
import { ONBOARDING_WORKSPACE } from "@/constants/spotlightConfig";
import { useTasks } from "@/contexts/tasksContext";
import { useTaskCreation } from "@/contexts/taskCreationContext";
import InlineCategoryCreator from "@/components/InlineCategoryCreator";
import CreateModal, { Screen } from "@/components/modals/CreateModal";
import CongratulateModal from "@/components/modals/CongratulateModal";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Images, Plus } from "phosphor-react-native";
import TutorialCursor from "@/components/onboarding/TutorialCursor";
import SwipableTaskCard from "@/components/cards/SwipableTaskCard";
import ProductivityRingsCard from "@/components/profile/ProductivityRings";
import PostCardHeader from "@/components/cards/PostCardHeader";
import PostCardMedia from "@/components/cards/PostCardMedia";
import PostCardFooter from "@/components/cards/PostCardFooter";
import CachedImage from "@/components/CachedImage";
import TaskToast from "@/components/ui/TaskToast";
import { Task, RingState } from "@/api/types";
import { useAuth } from "@/hooks/useAuth";
import { useRequest } from "@/hooks/useRequest";
import { registerForPushNotificationsAsync, sendPushTokenToBackend } from "@/utils/notificationService";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

// Centered kudos card for the blurred spotlight. Purpose-built from plain
// Views: KudosItem/SpeechBubbleCard collapses when mounted inside the animated
// overlay on the new arch, so the spotlight doesn't reuse it.
function SpotlightKudos({ gif, message }: { gif?: string; message?: string }) {
    const ThemedColor = useThemeColor();
    // ponytail: JS-driven fade — native-driver anims on this subtree are what
    // broke layout; revisit if the Fabric/RN-Animated mount race gets fixed
    const fade = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.timing(fade, { toValue: 1, duration: 250, useNativeDriver: false }).start();
    }, []);
    return (
        <Animated.View
            style={[styles.spotlightCard, { opacity: fade, backgroundColor: ThemedColor.background, borderColor: ThemedColor.tertiary }]}>
            <View style={styles.spotlightHeader}>
                <CachedImage
                    source={{ uri: BEAK.picture }}
                    variant="thumbnail"
                    cachePolicy="memory-disk"
                    style={styles.spotlightAvatar}
                />
                <ThemedText type="default" style={{ flexShrink: 1 }}>
                    <ThemedText type="defaultSemiBold">beak</ThemedText> sent you kudos
                </ThemedText>
            </View>
            {gif ? (
                <Image source={{ uri: gif }} style={styles.spotlightGif} resizeMode="cover" />
            ) : (
                <ThemedText type="lightBody" style={{ color: ThemedColor.caption }}>{message}</ThemedText>
            )}
        </Animated.View>
    );
}

// Per-phase step dots: phase 1 "Do your first task" (steps 0-2),
// phase 2 "Share it" (rings → post → kudos).
function PhaseProgress({ label, current }: { label: string; current: number }) {
    const ThemedColor = useThemeColor();
    return (
        <View style={styles.stepIndicatorRow}>
            <View style={styles.dotsRow}>
                {[0, 1, 2].map((i) => (
                    <View
                        key={i}
                        style={[styles.dot, { backgroundColor: i <= current ? ThemedColor.primary : ThemedColor.tertiary }]}
                    />
                ))}
            </View>
            <ThemedText type="caption" style={{ color: ThemedColor.caption, flexShrink: 1 }}>
                {label} · Step {current + 1} of 3
            </ThemedText>
        </View>
    );
}

const BEAK = {
    id: "67eef59f4931ee7a9fb630e5",
    name: "beak",
    picture:
        "https://kindred.nyc3.digitaloceanspaces.com/profiles/67eef59f4931ee7a9fb630e5/ba16e335-bd38-4a0a-b5c0-b6e30f94b3f6.jpg",
};
const DISPLAY_WORKSPACE = "Example Workspace";
const PREFILL_CATEGORY = "My Tasks";
const PREFILL_TASK = "Finish Kindred Onboarding";
const CONGRATS_MESSAGE = "it's beak, one of kindred's founders; welcome! and congrats on finishing your first (of many!) tasks :)";
const CONGRATS_GIF = "https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExcnp1MHYxaTN0aG1sdHI5aWNleDA0MmV4cXR6Z3ZtbmcxdnM3MmlxNiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/4LibSc90N18FBLvMJd/giphy.gif";

// Beak's own post in the mini-feed: the user sends kudos on beak's task,
// which is the direction kudos actually flow in the real app.
const BEAK_CATEGORY = "Kindred HQ";
const BEAK_TASK = { id: "beak-demo-task", content: "Ship the new onboarding", value: 5, priority: 1, categoryId: "" };
const KUDOS_PREFILL = "nice work beak!! 🎉";
const KUDOS_DEFINITION = "Kudos are quick congrats you send when a friend finishes something.";

// The photo the user "adds" to their post during the guided share step.
const SHARE_PHOTO = "https://i.pinimg.com/736x/6e/6a/47/6e6a475d2f7967465952e2cbfde1c66e.jpg";

const STEP_CATEGORY = 0;
const STEP_TASK = 1;
const STEP_COMPLETE = 2;
const STEP_RINGS = 3;
const STEP_SHARE = 4;
const STEP_CONGRATS = 5;

// Demo ring state for the explainer: plan + do closed (they just planned + did a
// task), share still open — the user closes the share ring in the next sequence.
const DEMO_RINGS: RingState = {
    _id: "tutorial",
    user_id: "tutorial",
    date: new Date().toISOString(),
    plan: { current: 1, target: 1, closed: true },
    do: { current: 1, target: 1, closed: true },
    share: { current: 0, target: 1, closed: false },
    all_closed: false,
    reward_claimed: false,
};

export default function TutorialOnboarding() {
    const ThemedColor = useThemeColor();
    const insets = useSafeAreaInsets();
    const { onboardingData } = useOnboarding();
    const isSocialAuth = !!(onboardingData.appleId || onboardingData.googleId);
    const totalSteps = isSocialAuth ? 4 : 5;
    const router = useRouter();
    const { capture } = useAnalytics();
    const { user } = useAuth();
    const { workspaces, fetchWorkspaces, setCreateCategory, categories } = useTasks();
    const { setTaskName, resetTaskCreation } = useTaskCreation();
    const { request } = useRequest();

    const [step, setStep] = useState(0);
    const [showConfetti, setShowConfetti] = useState(false);
    const [showRingCursor, setShowRingCursor] = useState(false); // share-ring guide on the rings step
    const [showShareToast, setShowShareToast] = useState(false); // top toast appears a beat later
    const [shareClosed, setShareClosed] = useState(false); // share ring closed after posting
    const [sharePhase, setSharePhase] = useState<"toast" | "caption" | "posted">("toast");
    // Composer reveals one element at a time: 1 = preview card, 2 = photo added, 3 = post button
    const [shareStage, setShareStage] = useState(0);
    const friendCursorX = useRef(new Animated.Value(0)).current; // beak's red cursor fly-in
    const friendCursorY = useRef(new Animated.Value(0)).current;
    const [isCreatingCategory, setIsCreatingCategory] = useState(true); // start with creator open

    // Data from tutorial actions
    const [categoryId, setCategoryId] = useState<string | null>(null);
    const [categoryName, setCategoryName] = useState<string | null>(null);
    const [taskData, setTaskData] = useState<Task | null>(null);

    // Create modal (step 1)
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Prompt card animation
    const promptOpacity = useRef(new Animated.Value(0)).current;
    const promptSlide = useRef(new Animated.Value(20)).current;

    // Swipe hint nudge
    const swipeHintAnim = useRef(new Animated.Value(0)).current;

    // Guiding cursor — a tap pulse on step 1, a swipe sweep on step 2
    const tapCursorScale = useRef(new Animated.Value(1)).current;
    const tapCursorX = useRef(new Animated.Value(0)).current; // glide-in offset
    const tapCursorY = useRef(new Animated.Value(0)).current;
    const swipeCursorX = useRef(new Animated.Value(0)).current;
    const ringsStepAnim = useRef(new Animated.Value(0)).current; // rings page enter transition

    const captionAnim = useRef(new Animated.Value(0)).current; // caption screen fade-in
    // Feed / congrats beats: beak's cursor clicks your post, kudos take over a
    // blurred overlay one at a time, then beak's post + the kudos CTA appear.
    const feedAnim = useRef(new Animated.Value(0)).current; // feed fade-in
    const friendCursorScale = useRef(new Animated.Value(1)).current; // beak's click pulse
    const kudosBlurAnim = useRef(new Animated.Value(0)).current; // kudos spotlight fade
    const [congratsPhase, setCongratsPhase] = useState<"post" | "kudos1" | "kudos2" | "beakPost">("post");
    const [showKudosModal, setShowKudosModal] = useState(false);

    const confettiRef = useRef<any>(null);

    // ─── Init ───────────────────────────────────────────────────────
    useEffect(() => {
        const init = async () => {
            // Request push notification permission early so the beak congrats
            // notification can actually be delivered
            registerForPushNotificationsAsync().then((result) => {
                if (result?.token) sendPushTokenToBackend(result.token);
            });

            // The Kindred Guide workspace is seeded server-side at registration
            // (auth.SetupDefaultWorkspace); just load it here.
            await fetchWorkspaces(true);
        };
        init();
    }, []);

    // The Guide workspace is never globally selected — the creator targets it
    // via its workspaceName prop, so the app stays on home throughout.
    const guideReady = workspaces.some((w) => w.name === ONBOARDING_WORKSPACE);

    useEffect(() => {
        capture(AnalyticsEvents.ONBOARDING_STEP_VIEWED, {
            step_name: OnboardingSteps.TUTORIAL.name,
            step_index: OnboardingSteps.TUTORIAL.index,
        });
    }, []);

    // ─── Step-0 entrance stagger: header → prompt card → category creator ──
    const introHeaderAnim = useRef(new Animated.Value(0)).current;
    const introCreatorAnim = useRef(new Animated.Value(0)).current;
    const [introCreatorReady, setIntroCreatorReady] = useState(false);
    useEffect(() => {
        Animated.timing(introHeaderAnim, { toValue: 1, duration: 500, easing: CURSOR_EASE, useNativeDriver: true }).start();
        // Mount the creator late so its name-typewriter starts after the stagger
        const t = setTimeout(() => {
            setIntroCreatorReady(true);
            Animated.timing(introCreatorAnim, { toValue: 1, duration: 400, easing: CURSOR_EASE, useNativeDriver: true }).start();
        }, 1300);
        return () => clearTimeout(t);
    }, []);

    // ─── Prompt card animation on step change ───────────────────────
    useEffect(() => {
        // First step waits for the header to land; later steps come in quicker
        const delay = step === STEP_CATEGORY ? 700 : 300;
        promptOpacity.setValue(0);
        promptSlide.setValue(20);
        Animated.parallel([
            Animated.timing(promptOpacity, {
                toValue: 1, duration: 500, delay, useNativeDriver: true,
            }),
            Animated.timing(promptSlide, {
                toValue: 0, duration: 500, delay, useNativeDriver: true,
            }),
        ]).start();
    }, [step]);

    // ─── Step 1: glide the cursor in to the category, then loop a tap hint ──
    useEffect(() => {
        if (step !== STEP_TASK) return;
        let cancelled = false;
        // Glide in on a smoothing curve instead of popping into place
        tapCursorX.setValue(-70);
        tapCursorY.setValue(-44);
        Animated.parallel([
            Animated.timing(tapCursorX, { toValue: 0, duration: 750, easing: CURSOR_EASE, useNativeDriver: true }),
            Animated.timing(tapCursorY, { toValue: 0, duration: 750, easing: CURSOR_EASE, useNativeDriver: true }),
        ]).start();
        const pulse = () => {
            if (cancelled) return;
            Animated.sequence([
                Animated.timing(tapCursorScale, { toValue: 0.75, duration: 280, useNativeDriver: true }),
                Animated.timing(tapCursorScale, { toValue: 1, duration: 320, useNativeDriver: true }),
            ]).start();
        };
        const start = setTimeout(pulse, 1000);
        const interval = setInterval(pulse, 1500);
        return () => {
            cancelled = true;
            clearTimeout(start);
            clearInterval(interval);
        };
    }, [step]);

    // ─── Step 2: slow swipe-right hint (cursor + card nudge), every 3s ──────
    useEffect(() => {
        if (step !== STEP_COMPLETE) return;
        let cancelled = false;
        const nudge = () => {
            if (cancelled) return;
            swipeHintAnim.setValue(0);
            swipeCursorX.setValue(0);
            Animated.parallel([
                Animated.sequence([
                    Animated.timing(swipeHintAnim, { toValue: 60, duration: 1200, easing: CURSOR_EASE, useNativeDriver: true }),
                    Animated.timing(swipeHintAnim, { toValue: 0, duration: 1200, easing: CURSOR_EASE, useNativeDriver: true }),
                ]),
                Animated.sequence([
                    Animated.timing(swipeCursorX, { toValue: 90, duration: 1200, easing: CURSOR_EASE, useNativeDriver: true }),
                    Animated.timing(swipeCursorX, { toValue: 0, duration: 1200, easing: CURSOR_EASE, useNativeDriver: true }),
                ]),
            ]).start();
        };
        const start = setTimeout(nudge, 1000);
        const interval = setInterval(nudge, 3000);
        return () => {
            cancelled = true;
            clearTimeout(start);
            clearInterval(interval);
        };
    }, [step]);

    // ─── Step 0: Category created ───────────────────────────────────
    const handleCategoryCreated = useCallback((id: string, name: string) => {
        setCategoryId(id);
        setCategoryName(name);
        setIsCreatingCategory(false);
        setStep(STEP_TASK);
    }, []);

    const handleCancelCategory = useCallback(() => {
        setIsCreatingCategory(false);
    }, []);

    const handleStartCreatingCategory = useCallback(() => {
        setIsCreatingCategory(true);
    }, []);

    // ─── Step 1: Tap category to open create modal ──────────────────
    const handleCategoryPress = useCallback(() => {
        if (step === STEP_TASK && categoryId && categoryName) {
            resetTaskCreation();
            setTaskName(""); // typewriter fills it once the sheet is open
            setCreateCategory({ label: categoryName, id: categoryId, special: false });
            setShowCreateModal(true);
        }
    }, [step, categoryId, categoryName]);

    // Type the task name for the user once the create sheet is open (read-only field)
    useEffect(() => {
        if (!showCreateModal) return;
        let i = 0;
        let cancelled = false;
        const tick = () => {
            if (cancelled) return;
            i++;
            setTaskName(PREFILL_TASK.slice(0, i));
            if (i < PREFILL_TASK.length) setTimeout(tick, 100);
        };
        const start = setTimeout(tick, 900); // wait for the present animation, then type
        return () => {
            cancelled = true;
            clearTimeout(start);
        };
    }, [showCreateModal]);

    const handleCreateModalClose = useCallback((visible: boolean) => {
        setShowCreateModal(visible);


    }, []);

    // Watch for task creation in our category
    useEffect(() => {
        if (!categoryId) return;

        let cat = categories?.find((c: any) => c.id === categoryId);
        if (!cat) {
            for (const ws of workspaces) {
                cat = ws.categories?.find((c: any) => c.id === categoryId);
                if (cat) break;
            }
        }

        if (cat && cat.tasks?.length > 0) {
            const latestTask = cat.tasks[0];
            if (!taskData) {
                setTaskData(latestTask);
                if (step === STEP_TASK) {
                    setTimeout(() => setStep(STEP_COMPLETE), 300);
                }
            } else if (latestTask.id !== taskData.id) {
                setTaskData(latestTask);
            }
        }
    }, [categories, workspaces, categoryId, taskData, step]);

    // Fallback: refresh from server if task not detected after modal close
    const createModalShownRef = useRef(false);
    useEffect(() => {
        if (showCreateModal) createModalShownRef.current = true;
    }, [showCreateModal]);

    useEffect(() => {
        if (showCreateModal || step !== STEP_TASK || !categoryId || taskData) return;
        if (!createModalShownRef.current) return;
        const timer = setTimeout(() => {
            fetchWorkspaces(true);
        }, 2000);
        return () => clearTimeout(timer);
    }, [showCreateModal, step, categoryId, taskData, fetchWorkspaces]);

    // ─── Step 2: Detect swipe completion ──────────────────────────────
    const completionHandledRef = useRef(false);

    useEffect(() => {
        if (step !== STEP_COMPLETE || !categoryId || !taskData || completionHandledRef.current) return;

        let cat = categories?.find((c: any) => c.id === categoryId);
        if (!cat) {
            for (const ws of workspaces) {
                cat = ws.categories?.find((c: any) => c.id === categoryId);
                if (cat) break;
            }
        }
        const taskStillExists = cat?.tasks?.some((t: any) => t.id === taskData.id);
        if (!taskStillExists) {
            completionHandledRef.current = true;

            setShowConfetti(true);
            if (Platform.OS === "ios") {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            // First task done → explain the rings before the congrats payoff
            setTimeout(() => setStep(STEP_RINGS), 1500);
        }
    }, [categories, workspaces, categoryId, taskData, step]);

    // ─── Rings step: reveal the share-ring guide cursor after the fill plays ──
    useEffect(() => {
        if (step !== STEP_RINGS) {
            setShowRingCursor(false);
            setShowShareToast(false);
            ringsStepAnim.setValue(0);
            return;
        }
        // Page-enter transition: fade + slide the rings in
        Animated.timing(ringsStepAnim, { toValue: 1, duration: 600, easing: CURSOR_EASE, useNativeDriver: true }).start();
        // Reveal the share-ring cursor after the rings stagger in; the toast
        // follows once the cursor's label finishes typing (onLabelTyped)
        const t1 = setTimeout(() => setShowRingCursor(true), 2500);
        return () => clearTimeout(t1);
    }, [step]);

    // Toast springs down from the top like a real toast
    const toastAnim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        if (!showShareToast) {
            toastAnim.setValue(0);
            return;
        }
        Animated.spring(toastAnim, { toValue: 1, stiffness: 240, damping: 24, mass: 0.9, useNativeDriver: false }).start();
    }, [showShareToast]);

    // Real beak kudos on the post (stored so it shows in the actual notifications too)
    const sendCongratulation = async () => {
        try {
            await request("POST", "/user/congratulations/beak", {
                message: CONGRATS_MESSAGE,
                categoryName: categoryName ?? PREFILL_CATEGORY,
                taskName: taskData?.content ?? PREFILL_TASK,
            });
        } catch {}
    };

    // ─── Feed step: enter on the "post" phase and store the real beak kudos ──
    useEffect(() => {
        if (step !== STEP_CONGRATS) return;
        setCongratsPhase("post");
        sendCongratulation();
        feedAnim.setValue(0);
        Animated.timing(feedAnim, { toValue: 1, duration: 500, easing: CURSOR_EASE, useNativeDriver: true }).start();
    }, [step]);

    // Any tap (or the Next button) moves to the next beat
    const advanceCongrats = useCallback(() => {
        setCongratsPhase((p) => (p === "post" ? "kudos1" : p === "kudos1" ? "kudos2" : "beakPost"));
    }, []);

    // Per-phase beats: cursor click on your post, then the kudos overlay
    // advances on its own; "kudos2" waits for the Next button.
    useEffect(() => {
        if (step !== STEP_CONGRATS) return;
        if (congratsPhase === "post") {
            const click = setTimeout(() => {
                if (Platform.OS === "ios") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                Animated.sequence([
                    Animated.timing(friendCursorScale, { toValue: 0.75, duration: 160, useNativeDriver: true }),
                    Animated.timing(friendCursorScale, { toValue: 1, duration: 200, useNativeDriver: true }),
                ]).start();
            }, 1100);
            const adv = setTimeout(advanceCongrats, 1700);
            return () => {
                clearTimeout(click);
                clearTimeout(adv);
            };
        }
        if (congratsPhase === "kudos1") {
            // No auto-advance — each kudos waits for its Next button
            kudosBlurAnim.setValue(0);
            Animated.timing(kudosBlurAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
        }
    }, [step, congratsPhase, advanceCongrats]);

    // Final action: open the real kudos modal to congratulate beak's task.
    const handleSendKudosBack = () => {
        if (Platform.OS === "ios") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setShowKudosModal(true);
    };

    // Tap the top toast → open the caption screen (ring does NOT close yet).
    const handleToastTap = () => {
        if (Platform.OS === "ios") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSharePhase("caption");
        setStep(STEP_SHARE);
    };

    // Share screen: slide up like a real screen push, then stage the preview card in
    useEffect(() => {
        if (step !== STEP_SHARE || sharePhase !== "caption") {
            setShareStage(0);
            return;
        }
        captionAnim.setValue(0);
        Animated.timing(captionAnim, { toValue: 1, duration: 450, easing: CURSOR_EASE, useNativeDriver: true }).start();
        const t = setTimeout(() => setShareStage(1), 900);
        return () => clearTimeout(t);
    }, [step, sharePhase]);

    // Tap the photo slot → photo drops into the preview, then the Post button appears
    const handleAddPhoto = useCallback(() => {
        if (Platform.OS === "ios") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setShareStage(2);
        setTimeout(() => setShareStage(3), 700);
    }, []);

    const handlePostShare = () => {
        if (Platform.OS === "ios") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setSharePhase("posted"); // show the share ring closing
        setShareClosed(true);
        setTimeout(() => setStep(STEP_CONGRATS), 2600);
    };

    // ─── Congrats: beak's red cursor flies in next to your cursor ──
    useEffect(() => {
        if (step !== STEP_CONGRATS) return;
        friendCursorX.setValue(screenWidth * 0.4);
        friendCursorY.setValue(-90);
        Animated.parallel([
            Animated.timing(friendCursorX, { toValue: 0, duration: 900, easing: CURSOR_EASE, useNativeDriver: true }),
            Animated.timing(friendCursorY, { toValue: 0, duration: 900, easing: CURSOR_EASE, useNativeDriver: true }),
        ]).start();
    }, [step]);

    const handleContinue = () => {
        capture(AnalyticsEvents.ONBOARDING_STEP_COMPLETED, {
            step_name: OnboardingSteps.TUTORIAL.name,
            step_index: OnboardingSteps.TUTORIAL.index,
        });
        router.push("/(onboarding)/calendar");
    };

    // ─── Prompt text per step ───────────────────────────────────────
    const prompts: Record<number, { title: string; subtitle: string }> = {
        0: { title: "Create a category", subtitle: "Workspaces hold categories, and categories hold tasks" },
        1: { title: "Add a task", subtitle: "Tap the category to create one" },
        2: { title: "Complete your task", subtitle: "Swipe right to mark it done" },
    };

    return (
        <ThemedView style={styles.mainContainer}>
            <OnboardingProgressBar currentStep={totalSteps} totalSteps={totalSteps} />

            {showConfetti && (
                <View style={styles.confettiContainer}>
                    <Confetti />
                </View>
            )}

            <CreateModal
                visible={showCreateModal}
                setVisible={handleCreateModalClose}
                categoryId={categoryId ?? undefined}
                screen={Screen.STANDARD}
                tutorial
            />

            <CongratulateModal
                visible={showKudosModal}
                setVisible={setShowKudosModal}
                task={BEAK_TASK}
                congratulationConfig={{ receiverId: BEAK.id, categoryName: BEAK_CATEGORY, userHandle: BEAK.name }}
                tutorialPrefill={KUDOS_PREFILL}
                onSent={() => {
                    setShowKudosModal(false);
                    handleContinue();
                }}
            />

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
            {/* Workspace area — mimics real WorkspaceContent layout */}
            <View style={[styles.workspaceArea, { paddingTop: insets.top + 40 }]}>
                <View style={{ paddingHorizontal: HORIZONTAL_PADDING }}>
                    {/* Workspace header — same as WorkspaceContent (hidden once we leave the task steps) */}
                    {step < STEP_RINGS && (
                        <Animated.View
                            style={[
                                styles.workspaceHeader,
                                {
                                    opacity: introHeaderAnim,
                                    transform: [
                                        { translateY: introHeaderAnim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
                                    ],
                                },
                            ]}>
                            <ThemedText type="title" style={{ fontWeight: "600" }}>
                                {DISPLAY_WORKSPACE}
                            </ThemedText>
                        </Animated.View>
                    )}

                    {/* Categories container — matches categoriesContainer gap: 16 */}
                    <View style={styles.categoriesContainer}>
                        {/* InlineCategoryCreator — wait for the Guide workspace to load + entrance stagger */}
                        {isCreatingCategory && guideReady && introCreatorReady && (
                            <Animated.View
                                style={{
                                    opacity: introCreatorAnim,
                                    transform: [
                                        { translateY: introCreatorAnim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
                                    ],
                                }}>
                                <InlineCategoryCreator
                                    initialName={step === STEP_CATEGORY ? PREFILL_CATEGORY : undefined}
                                    onCreated={handleCategoryCreated}
                                    onCancel={handleCancelCategory}
                                    tutorial
                                    workspaceName={ONBOARDING_WORKSPACE}
                                />
                            </Animated.View>
                        )}

                        {/* Created category — uses real Category layout pattern */}
                        {step >= STEP_TASK && step < STEP_RINGS && categoryId && categoryName && (
                            <View style={[styles.categoryItemContainer, { position: "relative" }]}>
                                {/* Category header — matches category.tsx exactly */}
                                <TouchableOpacity
                                    style={styles.categoryHeaderRow}
                                    onPress={handleCategoryPress}
                                    activeOpacity={0.7}
                                >
                                    <ThemedText type={taskData ? "subtitle" : "disabledTitle"}>
                                        {categoryName}
                                    </ThemedText>
                                    <Plus size={16} weight="bold" color={ThemedColor.text} />
                                </TouchableOpacity>

                                {/* Guiding cursor: tap the category to add a task */}
                                {step === STEP_TASK && (
                                    <Animated.View
                                        pointerEvents="none"
                                        style={[styles.tapCursor, { transform: [{ translateX: tapCursorX }, { translateY: tapCursorY }, { scale: tapCursorScale }] }]}>
                                        <TutorialCursor size={32} />
                                    </Animated.View>
                                )}

                                {/* Task — real SwipableTaskCard wrapped in nudge */}
                                {step >= STEP_COMPLETE && step < STEP_RINGS && taskData && (
                                    <Animated.View style={{ position: "relative", transform: [{ translateX: swipeHintAnim }] }}>
                                        <SwipableTaskCard
                                            categoryId={categoryId}
                                            task={taskData}
                                            categoryName={categoryName}
                                            redirect={false}
                                            tutorial
                                        />
                                        {/* Guiding cursor: swipe the task right to complete it */}
                                        <Animated.View
                                            pointerEvents="none"
                                            style={[styles.swipeCursor, { transform: [{ translateX: swipeCursorX }] }]}>
                                            <TutorialCursor size={32} />
                                        </Animated.View>
                                    </Animated.View>
                                )}
                            </View>
                        )}

                        {/* + Add Category button — matches real workspace */}
                        {!isCreatingCategory && step === STEP_CATEGORY && (
                            <TouchableOpacity
                                onPress={handleStartCreatingCategory}
                                style={{ alignSelf: "center", paddingVertical: 8 }}
                                activeOpacity={0.6}
                            >
                                <ThemedText type="default" style={{ color: ThemedColor.caption }}>
                                    + Add Category
                                </ThemedText>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Rings explainer — real home rings, demo state (share still open) */}
                {step === STEP_RINGS && (
                    <Animated.View
                        style={[
                            styles.ringsStep,
                            {
                                opacity: ringsStepAnim,
                                transform: [{ translateY: ringsStepAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
                            },
                        ]}
                        onTouchEnd={() => {
                            setShowRingCursor(true);
                            setShowShareToast(true);
                        }}>
                        <View style={{ marginBottom: 16 }}>
                            <PhaseProgress label="Share it" current={0} />
                        </View>
                        <ThemedText type="title" style={{ fontWeight: "600", marginBottom: 6 }}>
                            Your daily rings
                        </ThemedText>
                        <ThemedText type="default" style={{ color: ThemedColor.caption, marginBottom: 4 }}>
                            Close all three every day.
                        </ThemedText>

                        <ProductivityRingsCard
                            variant="rings"
                            staggerMs={600}
                            ringsOverride={
                                shareClosed
                                    ? { ...DEMO_RINGS, share: { current: 1, target: 1, closed: true }, all_closed: true }
                                    : DEMO_RINGS
                            }
                        />

                        <View style={styles.ringCards}>
                            {[
                                { label: "Plan", desc: "Add tasks to your day" },
                                { label: "Do", desc: "Complete them" },
                                { label: "Share", desc: "Post a win or send kudos" },
                            ].map((r) => (
                                <View key={r.label} style={[styles.ringCard, { backgroundColor: ThemedColor.lightened }]}>
                                    <View style={[styles.ringDot, { backgroundColor: ThemedColor.primary }]} />
                                    <ThemedText type="defaultSemiBold">{r.label}</ThemedText>
                                    <ThemedText type="caption" style={{ color: ThemedColor.caption, flexShrink: 1 }}>
                                        {r.desc}
                                    </ThemedText>
                                </View>
                            ))}
                        </View>

                        {showRingCursor && (
                            <View style={styles.ringCursor}>
                                <TutorialCursor
                                    size={34}
                                    label="Let's close your Share ring"
                                    onLabelTyped={() => setTimeout(() => setShowShareToast(true), 350)}
                                />
                            </View>
                        )}
                    </Animated.View>
                )}

                {/* Share step — "posted" phase shows the share ring closing */}
                {step === STEP_SHARE && sharePhase === "posted" && (
                    <View style={styles.ringsStep}>
                        <ThemedText type="title" style={{ fontWeight: "600", marginBottom: 6 }}>
                            Share ring closed!
                        </ThemedText>
                        <ProductivityRingsCard
                            variant="rings"
                            ringsOverride={{ ...DEMO_RINGS, share: { current: 1, target: 1, closed: true }, all_closed: true }}
                        />
                    </View>
                )}

            </View>

            {/* Bottom prompt card */}
            <View style={[styles.promptArea, { paddingBottom: insets.bottom }]}>
                {step < STEP_RINGS && prompts[step]?.title ? (
                    <Animated.View style={[styles.promptCard, {
                        opacity: promptOpacity,
                        transform: [{ translateY: promptSlide }],
                        backgroundColor: ThemedColor.lightened,
                    }]}>
                        <ThemedText style={[styles.promptTitle, { color: ThemedColor.text }]}>
                            {prompts[step].title}
                        </ThemedText>
                        <ThemedText style={[styles.promptSubtitle, { color: ThemedColor.caption }]}>
                            {prompts[step].subtitle}
                        </ThemedText>

                        <PhaseProgress label="Do your first task" current={step} />
                    </Animated.View>
                ) : null}

            </View>
            </KeyboardAvoidingView>

            {/* Completion toast pinned at the top — persistent, can't be dismissed */}
            {step === STEP_RINGS && showShareToast && (
                <View style={styles.toastOverlay} pointerEvents="box-none">
                    <Animated.View
                        pointerEvents="box-none"
                        style={{
                            alignSelf: "stretch",
                            alignItems: "center",
                            opacity: toastAnim,
                            transform: [
                                { translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [-(insets.top + 90), 0] }) },
                            ],
                        }}>
                        <View style={[styles.toastWrap, { marginTop: insets.top + 8 }]}>
                            <TaskToast
                                message="Tap here to post your task and close your Share ring!"
                                status="success"
                                onPressOverride={handleToastTap}
                                disableDismiss
                            />
                        </View>
                    </Animated.View>
                </View>
            )}

            {/* Share: guided "New Post" composer — slides up, then reveals the
                preview, the photo step, and the Post button one at a time */}
            {step === STEP_SHARE && sharePhase === "caption" && (
                <Animated.View
                    style={[
                        StyleSheet.absoluteFill,
                        {
                            transform: [
                                {
                                    translateY: captionAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [screenHeight, 0],
                                    }),
                                },
                            ],
                        },
                    ]}>
                  <ThemedView style={StyleSheet.absoluteFill}>
                    <ScrollView
                        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 24 + insets.bottom }}
                        keyboardShouldPersistTaps="handled">
                        <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
                            <PhaseProgress label="Share it" current={1} />
                        </View>
                        <ThemedText type="subtitle" style={{ paddingHorizontal: 16, marginBottom: 4 }}>
                            New Post
                        </ThemedText>
                        <ThemedText type="caption" style={{ color: ThemedColor.caption, paddingHorizontal: 16, marginBottom: 16 }}>
                            Posting shares your win with friends — and closes your Share ring.
                        </ThemedText>

                        {shareStage >= 1 && (
                            <View style={{ paddingHorizontal: 16 }}>
                                <View style={styles.postPreview}>
                                    <PostCardHeader
                                        icon={user?.profile_picture}
                                        name={user?.display_name ?? "You"}
                                        username={user?.handle ?? undefined}
                                        timeLabel="Just now"
                                        disableNavigation
                                    />
                                    {shareStage === 1 && (
                                        <TouchableOpacity
                                            style={[styles.photoSlot, { borderColor: ThemedColor.tertiary }]}
                                            onPress={handleAddPhoto}
                                            activeOpacity={0.7}>
                                            <Images size={28} color={ThemedColor.caption} />
                                            <ThemedText type="caption" style={{ color: ThemedColor.caption }}>
                                                Add a photo
                                            </ThemedText>
                                            <View pointerEvents="none" style={styles.photoSlotCursor}>
                                                <TutorialCursor size={30} />
                                            </View>
                                        </TouchableOpacity>
                                    )}
                                    {shareStage >= 2 && (
                                        <PostCardMedia
                                            images={[SHARE_PHOTO]}
                                            media={[{ type: "image", url: SHARE_PHOTO, thumbnailUrl: SHARE_PHOTO, width: 0, height: 0 }]}
                                            dual={null}
                                            imageHeight={220}
                                        />
                                    )}
                                    <PostCardFooter category={categoryName ?? PREFILL_CATEGORY} taskName={taskData?.content ?? PREFILL_TASK} readOnly />
                                </View>
                            </View>
                        )}

                        {shareStage >= 3 && (
                            <View style={{ padding: 16 }}>
                                <View>
                                    <PrimaryButton title="Post" onPress={handlePostShare} />
                                    <View pointerEvents="none" style={styles.postCursor}>
                                        <TutorialCursor size={30} />
                                    </View>
                                </View>
                            </View>
                        )}
                    </ScrollView>
                  </ThemedView>
                </Animated.View>
            )}

            {/* Feed — beak's cursor clicks your post, kudos take over a blurred
                overlay one at a time, then beak's post appears with the kudos CTA */}
            {step === STEP_CONGRATS && (
                <Animated.View style={[StyleSheet.absoluteFill, { opacity: feedAnim }]}>
                    <ThemedView style={{ flex: 1 }}>
                        <ScrollView
                            onTouchEnd={congratsPhase === "post" ? advanceCongrats : undefined}
                            contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 24 + insets.bottom, paddingHorizontal: 16 }}>
                            <View style={{ marginBottom: 16 }}>
                                <PhaseProgress label="Share it" current={2} />
                            </View>
                            <ThemedText type="subtitle" style={{ marginBottom: 12 }}>
                                Your feed
                            </ThemedText>

                            {/* Your post */}
                            <View style={styles.postPreview}>
                                <PostCardHeader
                                    icon={user?.profile_picture}
                                    name={user?.display_name ?? "You"}
                                    username={user?.handle ?? undefined}
                                    timeLabel="Just now"
                                    disableNavigation
                                />
                                <PostCardMedia
                                    images={[SHARE_PHOTO]}
                                    media={[{ type: "image", url: SHARE_PHOTO, thumbnailUrl: SHARE_PHOTO, width: 0, height: 0 }]}
                                    dual={null}
                                    imageHeight={180}
                                />
                                <PostCardFooter category={categoryName ?? PREFILL_CATEGORY} taskName={taskData?.content ?? PREFILL_TASK} readOnly />
                            </View>

                            {/* beak's own post — the user sends kudos on it, the real direction */}
                            {congratsPhase === "beakPost" && (
                                <>
                                    <ThemedText type="subtitle" style={{ marginTop: 24, marginBottom: 12 }}>
                                        beak completed a task
                                    </ThemedText>
                                    <View style={styles.postPreview}>
                                        <PostCardHeader
                                            icon={BEAK.picture}
                                            name={BEAK.name}
                                            username="@beak"
                                            timeLabel="Just now"
                                            disableNavigation
                                        />
                                        <PostCardFooter category={BEAK_CATEGORY} taskName={BEAK_TASK.content} readOnly />
                                    </View>
                                    <View style={{ marginTop: 24, gap: 12 }}>
                                        <ThemedText type="caption" style={{ color: ThemedColor.caption }}>
                                            {KUDOS_DEFINITION}
                                        </ThemedText>
                                        <PrimaryButton title="Send beak kudos" onPress={handleSendKudosBack} />
                                    </View>
                                </>
                            )}
                        </ScrollView>

                        {/* beak's cursor flies in and clicks your post */}
                        {congratsPhase === "post" && (
                            <Animated.View
                                pointerEvents="none"
                                style={[
                                    styles.feedBeakCursor,
                                    { transform: [{ translateX: friendCursorX }, { translateY: friendCursorY }, { scale: friendCursorScale }] },
                                ]}>
                                <TutorialCursor size={30} label="beak" color="#FF5A5F" bubbleLeft />
                            </Animated.View>
                        )}

                        {/* Blurred kudos spotlight — one kudos in focus at a time */}
                        {(congratsPhase === "kudos1" || congratsPhase === "kudos2") && (
                            <Animated.View style={[StyleSheet.absoluteFill, { opacity: kudosBlurAnim }]}>
                                <BlurView intensity={40} tint="default" style={StyleSheet.absoluteFill} />
                                <View style={styles.kudosOverlay}>
                                    {congratsPhase === "kudos1" ? (
                                        <SpotlightKudos key="c-gif" gif={CONGRATS_GIF} />
                                    ) : (
                                        <SpotlightKudos key="c-text" message={CONGRATS_MESSAGE} />
                                    )}
                                    <View style={{ marginTop: 24 }}>
                                        <PrimaryButton title="Next" onPress={advanceCongrats} />
                                    </View>
                                </View>
                            </Animated.View>
                        )}
                    </ThemedView>
                </Animated.View>
            )}
        </ThemedView>
    );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    mainContainer: {
        flex: 1,
    },
    confettiContainer: {
        position: "absolute",
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 10,
        height: screenHeight,
        pointerEvents: "none" as const,
    },

    // Workspace area — matches WorkspaceContent (no flex: 1, takes only needed height)
    workspaceArea: {
    },
    workspaceHeader: {
        paddingBottom: 24,
        paddingTop: 20,
    },
    // Matches WorkspaceContent categoriesContainer
    categoriesContainer: {
        gap: 16,
        marginTop: 0,
    },
    // Matches category.tsx container
    categoryItemContainer: {
        gap: 12,
        marginBottom: 4,
    },
    // Matches category.tsx TouchableOpacity style
    categoryHeaderRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    tapCursor: {
        position: "absolute",
        top: 20,
        left: 80,
        zIndex: 50,
    },
    swipeCursor: {
        position: "absolute",
        top: "50%",
        left: 24,
        marginTop: -10,
        zIndex: 50,
    },
    stepIndicatorRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 12,
    },
    ringsStep: {
        paddingHorizontal: HORIZONTAL_PADDING,
        paddingTop: 8,
    },
    ringCards: {
        marginTop: 12,
        gap: 8,
    },
    ringCard: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 14,
    },
    ringDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    ringCursor: {
        marginTop: 20,
        marginLeft: 8,
        marginBottom: 56, // reserve room for the bubble below the arrow
    },
    postCursor: {
        position: "absolute",
        top: 6,
        right: 48,
    },
    photoSlot: {
        height: 140,
        margin: 12,
        borderRadius: 12,
        borderWidth: 1.5,
        borderStyle: "dashed",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
    },
    photoSlotCursor: {
        position: "absolute",
        right: "28%",
        bottom: 18,
    },
    feedBeakCursor: {
        position: "absolute",
        top: "30%",
        right: 64,
        zIndex: 50,
    },
    kudosOverlay: {
        flex: 1,
        justifyContent: "center",
        paddingHorizontal: 24,
    },
    spotlightCard: {
        borderRadius: 16,
        borderWidth: 0.5,
        padding: 16,
        gap: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
        elevation: 6,
    },
    spotlightHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    spotlightAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    spotlightGif: {
        width: "100%",
        height: 200,
        borderRadius: 10,
    },
    toastOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: "center",
        justifyContent: "flex-start",
        paddingHorizontal: 16,
    },
    toastWrap: {
        alignSelf: "stretch",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 14,
        elevation: 12,
    },
    postPreview: {
        borderRadius: 16,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 6,
    },
    dotsRow: {
        flexDirection: "row",
        gap: 6,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },

    // Prompt card — vertically centered in remaining space
    promptArea: {
        flex: 1,
        justifyContent: "center",
        paddingHorizontal: HORIZONTAL_PADDING,
    },
    promptCard: {
        gap: 6,
        borderRadius: 20,
        padding: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    promptTitle: {
        fontSize: 24,
        fontFamily: "Fraunces",
        fontWeight: "600",
        letterSpacing: -0.5,
    },
    promptSubtitle: {
        fontSize: 15,
        fontFamily: "Outfit",
        fontWeight: "400",
        lineHeight: 21,
    },

});

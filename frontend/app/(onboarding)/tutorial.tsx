import {
    Dimensions,
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
import ConfettiCannon from "react-native-confetti-cannon";
import { LinearGradient } from "expo-linear-gradient";

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
import { Plus } from "phosphor-react-native";
import TutorialCursor from "@/components/onboarding/TutorialCursor";
import SwipableTaskCard from "@/components/cards/SwipableTaskCard";
import ProductivityRingsCard from "@/components/profile/ProductivityRings";
import PostCardHeader from "@/components/cards/PostCardHeader";
import PostCardMedia from "@/components/cards/PostCardMedia";
import PostCardFooter from "@/components/cards/PostCardFooter";
import KudosItem from "@/components/cards/KudosItem";
import MentionTextInput from "@/components/inputs/MentionTextInput";
import TaskToast from "@/components/ui/TaskToast";
import { Task, RingState } from "@/api/types";
import { useAuth } from "@/hooks/useAuth";
import { useRequest } from "@/hooks/useRequest";
import { registerForPushNotificationsAsync, sendPushTokenToBackend } from "@/utils/notificationService";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

const BEAK = {
    id: "67eef59f4931ee7a9fb630e5",
    name: "beak",
    picture:
        "https://kindred.nyc3.digitaloceanspaces.com/profiles/67eef59f4931ee7a9fb630e5/ba16e335-bd38-4a0a-b5c0-b6e30f94b3f6.jpg",
};
const CONGRATS_GIF = "https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExcnp1MHYxaTN0aG1sdHI5aWNleDA0MmV4cXR6Z3ZtbmcxdnM3MmlxNiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/4LibSc90N18FBLvMJd/giphy.gif";

const TAIL_SIZE = 10;
const DISPLAY_WORKSPACE = "Example Workspace";
const PREFILL_CATEGORY = "My Tasks";
const PREFILL_TASK = "Finish Kindred Onboarding";
const CONGRATS_MESSAGE = "it's beak, one of kindred's founders; welcome! and congrats on finishing your first (of many!) tasks :)";
const CREDITS_MESSAGE = "here are some credits for features I think you'll like. you can get more by closing your rings";

const STEP_CATEGORY = 0;
const STEP_TASK = 1;
const STEP_COMPLETE = 2;
const STEP_RINGS = 3;
const STEP_SHARE = 4;
const STEP_CONGRATS = 5;

// The completed task gets shared: post photo + auto-typed caption.
const SHARE_PHOTO = "https://i.pinimg.com/736x/6e/6a/47/6e6a475d2f7967465952e2cbfde1c66e.jpg";
const SHARE_CAPTION = "me when i finish kindred onboarding 🐐 #goat #productivity";

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
    const { user, updateUser } = useAuth();
    const { workspaces, fetchWorkspaces, setSelected, setCreateCategory, categories, selected, addToCategory } = useTasks();
    const { setTaskName, resetTaskCreation } = useTaskCreation();
    const { request } = useRequest();

    const [step, setStep] = useState(0);
    const [showConfetti, setShowConfetti] = useState(false);
    const [showRingCursor, setShowRingCursor] = useState(false); // share-ring guide on the rings step
    const [showShareToast, setShowShareToast] = useState(false); // top toast appears a beat later
    const [shareClosed, setShareClosed] = useState(false); // share ring closed after posting
    const [sharePhase, setSharePhase] = useState<"toast" | "caption" | "posted">("toast");
    const [captionText, setCaptionText] = useState(""); // auto-typed post caption
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
    // Feed / congrats reveal (beak congratulates on the post you just made)
    const feedAnim = useRef(new Animated.Value(0)).current; // feed fade-in
    const [showGifCongrats, setShowGifCongrats] = useState(false);
    const [showTextCongrats, setShowTextCongrats] = useState(false);
    const [showKudosBack, setShowKudosBack] = useState(false);
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

    useEffect(() => {
        if (workspaces.length > 0) {
            const guide = workspaces.find((w) => w.name === ONBOARDING_WORKSPACE);
            if (guide) setSelected(ONBOARDING_WORKSPACE);
        }
    }, [workspaces]);

    useEffect(() => {
        capture(AnalyticsEvents.ONBOARDING_STEP_VIEWED, {
            step_name: OnboardingSteps.TUTORIAL.name,
            step_index: OnboardingSteps.TUTORIAL.index,
        });
    }, []);

    // ─── Prompt card animation on step change ───────────────────────
    useEffect(() => {
        promptOpacity.setValue(0);
        promptSlide.setValue(20);
        Animated.parallel([
            Animated.timing(promptOpacity, {
                toValue: 1, duration: 500, delay: 300, useNativeDriver: true,
            }),
            Animated.timing(promptSlide, {
                toValue: 0, duration: 500, delay: 300, useNativeDriver: true,
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
        // Reveal the share-ring cursor after the rings stagger in, then the toast a beat later
        const t1 = setTimeout(() => setShowRingCursor(true), 4000);
        const t2 = setTimeout(() => setShowShareToast(true), 6200);
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
        };
    }, [step]);

    // Real beak congrats on the post (stored so it shows in the actual feed too)
    const sendCongratulation = async () => {
        try {
            await request("POST", "/user/congratulations/beak", {
                message: CONGRATS_MESSAGE,
                categoryName: categoryName ?? PREFILL_CATEGORY,
                taskName: taskData?.content ?? PREFILL_TASK,
            });
        } catch {}
    };

    // Grant the welcome AI credits silently (no gift beat — the user dropped it)
    const grantCreditsSilently = async () => {
        try {
            const response = await request("POST", "/user/congratulations/beak", {
                message: CREDITS_MESSAGE,
                categoryName: categoryName ?? PREFILL_CATEGORY,
                taskName: taskData?.content ?? PREFILL_TASK,
                grantCredits: true,
            });
            if (response?.creditsGranted && user?.credits) {
                const updated = { ...user.credits };
                for (const [key, amount] of Object.entries(response.creditsGranted)) {
                    if (key in updated) (updated as any)[key] += amount as number;
                }
                updateUser({ credits: updated });
            }
        } catch {}
    };

    // ─── Feed step: beak congratulates your post (GIF first, then text), then
    // you send a kudos back. beak's red cursor flies in alongside yours.
    useEffect(() => {
        if (step !== STEP_CONGRATS) return;
        sendCongratulation();
        grantCreditsSilently();

        feedAnim.setValue(0);
        Animated.timing(feedAnim, { toValue: 1, duration: 500, easing: CURSOR_EASE, useNativeDriver: true }).start();

        const t1 = setTimeout(() => {
            if (Platform.OS === "ios") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setShowGifCongrats(true);
        }, 1800);
        const t2 = setTimeout(() => setShowTextCongrats(true), 4200);
        const t3 = setTimeout(() => setShowKudosBack(true), 6000);
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
        };
    }, [step]);

    // Final action: open the real congratulate modal to send beak a kudos back.
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

    // Caption auto-types once the caption screen opens
    useEffect(() => {
        if (step !== STEP_SHARE || sharePhase !== "caption") return;
        captionAnim.setValue(0);
        Animated.timing(captionAnim, { toValue: 1, duration: 400, easing: CURSOR_EASE, useNativeDriver: true }).start();
        setCaptionText("");
        let i = 0;
        let cancelled = false;
        const tick = () => {
            if (cancelled) return;
            i++;
            setCaptionText(SHARE_CAPTION.slice(0, i));
            if (i < SHARE_CAPTION.length) setTimeout(tick, 55);
        };
        const start = setTimeout(tick, 500);
        return () => {
            cancelled = true;
            clearTimeout(start);
        };
    }, [step, sharePhase]);

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
        // Demo selected the Guide workspace; reset so they land on home, not that workspace
        setSelected("");
        router.push("/(onboarding)/calendar");
    };

    // ─── Prompt text per step ───────────────────────────────────────
    const prompts: Record<number, { title: string; subtitle: string }> = {
        0: { title: "Create a category", subtitle: "Workspaces hold categories, and categories hold tasks" },
        1: { title: "Add a task", subtitle: "Tap the category to create one" },
        2: { title: "Complete your task", subtitle: "Swipe right to mark it done" },
        3: { title: "", subtitle: "" },
    };

    return (
        <ThemedView style={styles.mainContainer}>
            <OnboardingProgressBar currentStep={totalSteps} totalSteps={totalSteps} />

            {showConfetti && (
                <View style={styles.confettiContainer}>
                    <ConfettiCannon
                        ref={confettiRef}
                        count={50}
                        origin={{ x: screenWidth / 2, y: (screenHeight / 4) * 3.7 }}
                        fallSpeed={1200}
                        explosionSpeed={300}
                        fadeOut={true}
                    />
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
                congratulationConfig={{ receiverId: BEAK.id, categoryName: categoryName ?? PREFILL_CATEGORY, userHandle: BEAK.name }}
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
                        <View style={styles.workspaceHeader}>
                            <ThemedText type="title" style={{ fontWeight: "600" }}>
                                {DISPLAY_WORKSPACE}
                            </ThemedText>
                        </View>
                    )}

                    {/* Categories container — matches categoriesContainer gap: 16 */}
                    <View style={styles.categoriesContainer}>
                        {/* InlineCategoryCreator — wait for selected workspace */}
                        {isCreatingCategory && selected === ONBOARDING_WORKSPACE && (
                            <InlineCategoryCreator
                                initialName={step === STEP_CATEGORY ? PREFILL_CATEGORY : undefined}
                                onCreated={handleCategoryCreated}
                                onCancel={handleCancelCategory}
                                tutorial
                            />
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
                        ]}>
                        <ThemedText type="title" style={{ fontWeight: "600", marginBottom: 6 }}>
                            Your daily rings
                        </ThemedText>
                        <ThemedText type="default" style={{ color: ThemedColor.caption, marginBottom: 4 }}>
                            Close all three every day.
                        </ThemedText>

                        <ProductivityRingsCard
                            variant="rings"
                            staggerMs={1000}
                            ringsOverride={
                                shareClosed
                                    ? { ...DEMO_RINGS, share: { current: 1, target: 1, closed: true }, all_closed: true }
                                    : DEMO_RINGS
                            }
                        />

                        <View style={styles.ringLegend}>
                            {[
                                { label: "Plan", desc: "plan your tasks" },
                                { label: "Do", desc: "complete them" },
                                { label: "Share", desc: "share your progress" },
                            ].map((r) => (
                                <View key={r.label} style={styles.ringLegendRow}>
                                    <View style={[styles.ringDot, { backgroundColor: ThemedColor.primary }]} />
                                    <ThemedText type="defaultSemiBold">{r.label}</ThemedText>
                                    <ThemedText type="caption" style={{ color: ThemedColor.caption, flexShrink: 1 }}>
                                        — {r.desc}
                                    </ThemedText>
                                </View>
                            ))}
                        </View>

                        {showRingCursor && (
                            <View style={styles.ringCursor}>
                                <TutorialCursor size={34} label="Let's close our share ring" />
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

                        <View style={styles.stepIndicatorRow}>
                            <View style={styles.dotsRow}>
                                {[0, 1, 2].map((i) => (
                                    <View
                                        key={i}
                                        style={[styles.dot, { backgroundColor: i <= step ? ThemedColor.primary : ThemedColor.tertiary }]}
                                    />
                                ))}
                            </View>
                            <ThemedText type="caption" style={{ color: ThemedColor.caption }}>
                                Step {step + 1} of 3
                            </ThemedText>
                        </View>
                    </Animated.View>
                ) : null}

            </View>
            </KeyboardAvoidingView>

            {/* Completion toast pinned at the top — persistent, can't be dismissed */}
            {step === STEP_RINGS && showShareToast && (
                <View style={styles.toastOverlay} pointerEvents="box-none">
                    <LinearGradient
                        colors={["rgba(0,0,0,0.30)", "rgba(0,0,0,0)"]}
                        style={styles.toastGradient}
                        pointerEvents="none"
                    />
                    <View style={[styles.toastWrap, { marginTop: insets.top + 8 }]}>
                        <TaskToast
                            message="Congrats! Click here to post and document your task!"
                            status="success"
                            onPressOverride={handleToastTap}
                            disableDismiss
                        />
                    </View>
                </View>
            )}

            {/* Share: a fake "New Post" caption screen — caption types itself, then Post */}
            {step === STEP_SHARE && sharePhase === "caption" && (
                <Animated.View style={[StyleSheet.absoluteFill, { opacity: captionAnim }]}>
                  <ThemedView style={StyleSheet.absoluteFill}>
                    <ScrollView
                        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 24 + insets.bottom }}
                        keyboardShouldPersistTaps="handled">
                        <ThemedText type="subtitle" style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                            New Post
                        </ThemedText>

                        <View style={{ paddingHorizontal: 16 }}>
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
                                    imageHeight={280}
                                />
                                <PostCardFooter category={categoryName ?? PREFILL_CATEGORY} taskName={taskData?.content ?? PREFILL_TASK} readOnly />
                            </View>
                        </View>

                        <View style={{ padding: 16, gap: 16 }}>
                            <View pointerEvents="none">
                                <MentionTextInput
                                    placeholder="Enter a caption"
                                    value={captionText}
                                    setValue={() => {}}
                                    fontSize={16}
                                    minHeight={80}
                                    onMentionPicked={() => {}}
                                />
                            </View>
                            <View>
                                <PrimaryButton title="Post" onPress={handlePostShare} />
                                {captionText.length >= SHARE_CAPTION.length && (
                                    <View pointerEvents="none" style={styles.postCursor}>
                                        <TutorialCursor size={30} />
                                    </View>
                                )}
                            </View>
                        </View>
                    </ScrollView>
                  </ThemedView>
                </Animated.View>
            )}

            {/* Feed — beak congratulates the post you just made; you kudos back */}
            {step === STEP_CONGRATS && (
                <Animated.View style={[StyleSheet.absoluteFill, { opacity: feedAnim }]}>
                    <ThemedView style={{ flex: 1 }}>
                        <ScrollView
                            contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 24 + insets.bottom, paddingHorizontal: 16 }}>
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

                            {/* beak congratulates — GIF first, then the text */}
                            {showGifCongrats && (
                                <View style={{ marginTop: 12 }}>
                                    <KudosItem
                                        kudos={{ id: "c-gif", sender: BEAK, message: CONGRATS_GIF, type: "image", timestamp: new Date().toISOString(), read: true }}
                                        formatTime={() => "now"}
                                        visible
                                        title="congratulated your post"
                                    />
                                </View>
                            )}
                            {showTextCongrats && (
                                <View style={{ marginTop: 12 }}>
                                    <KudosItem
                                        kudos={{ id: "c-text", sender: BEAK, message: CONGRATS_MESSAGE, timestamp: new Date().toISOString(), read: true }}
                                        formatTime={() => "now"}
                                        visible
                                        title="congratulated you"
                                    />
                                </View>
                            )}

                            {showKudosBack && (
                                <View style={{ marginTop: 24 }}>
                                    <PrimaryButton title="Send beak a kudos back" onPress={handleSendKudosBack} />
                                </View>
                            )}
                        </ScrollView>

                        {/* you + beak cursors — clearly two different people */}
                        <View pointerEvents="none" style={[styles.feedYouCursor, { top: insets.top + 56 }]}>
                            <TutorialCursor size={26} label="you" />
                        </View>
                        <Animated.View
                            pointerEvents="none"
                            style={[styles.feedBeakCursor, { transform: [{ translateX: friendCursorX }, { translateY: friendCursorY }] }]}>
                            <TutorialCursor size={30} label="beak" color="#FF5A5F" bubbleLeft />
                        </Animated.View>
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
    ringLegend: {
        marginTop: 12,
        gap: 8,
    },
    ringLegendRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
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
    feedYouCursor: {
        position: "absolute",
        left: 28,
        zIndex: 50,
    },
    feedBeakCursor: {
        position: "absolute",
        top: "44%",
        right: 56,
        zIndex: 50,
    },
    toastOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: "center",
        justifyContent: "flex-start",
        paddingHorizontal: 16,
    },
    toastGradient: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 220,
    },
    toastWrap: {
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

    // Congrats
    kudosRow: {
        flexDirection: "row",
        alignItems: "flex-start",
    },
    avatarSection: {
        alignItems: "center",
        gap: 6,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
    },
    avatarName: {
        fontSize: 11,
        fontFamily: "Outfit",
        textAlign: "center",
        width: 52,
    },
    bubbleWrapper: {
        flex: 1,
        flexDirection: "row",
        alignItems: "flex-start",
    },
    bubbleTail: {
        width: 0, height: 0,
        borderTopWidth: TAIL_SIZE,
        borderBottomWidth: TAIL_SIZE,
        borderRightWidth: TAIL_SIZE,
        borderTopColor: "transparent",
        borderBottomColor: "transparent",
        marginTop: 4,
    },
    bubbleCard: {
        flex: 1,
        borderRadius: 14,
        borderTopLeftRadius: 8,
        padding: 14,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
    },
    taskInfoRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        marginBottom: 6,
        flexWrap: "wrap",
    },
    taskInfoCategory: {
        fontSize: 15,
        fontFamily: "Outfit",
        fontWeight: "400",
        flexShrink: 1,
    },
    taskInfoDot: {
        width: 3, height: 3,
        borderRadius: 2,
        flexShrink: 0,
    },
    taskInfoName: {
        fontSize: 15,
        fontFamily: "Outfit",
        flexShrink: 1,
    },
    messageText: {
        fontSize: 16,
        fontFamily: "Outfit",
        lineHeight: 21,
        marginTop: 2,
    },
});

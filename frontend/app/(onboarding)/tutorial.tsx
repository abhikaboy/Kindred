import {
    Dimensions,
    StyleSheet,
    View,
    Animated,
    Platform,
    TouchableOpacity,
} from "react-native";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import ConfettiCannon from "react-native-confetti-cannon";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import OnboardingProgressBar from "@/components/onboarding/OnboardingProgressBar";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useAnalytics } from "@/hooks/useAnalytics";
import { AnalyticsEvents, OnboardingSteps } from "@/utils/analytics";
import { setupDefaultWorkspace } from "@/api/category";
import { ONBOARDING_WORKSPACE } from "@/constants/spotlightConfig";
import { useTasks } from "@/contexts/tasksContext";
import { useTaskCreation } from "@/contexts/taskCreationContext";
import CachedImage from "@/components/CachedImage";
import InlineCategoryCreator from "@/components/InlineCategoryCreator";
import CreateModal, { Screen } from "@/components/modals/CreateModal";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Plus } from "phosphor-react-native";
import SwipableTaskCard from "@/components/cards/SwipableTaskCard";
import { Task } from "@/api/types";
import { useAuth } from "@/hooks/useAuth";
import { useRequest } from "@/hooks/useRequest";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

const BEAK = {
    name: "beak",
    picture:
        "https://kindred.nyc3.digitaloceanspaces.com/profiles/67eef59f4931ee7a9fb630e5/ba16e335-bd38-4a0a-b5c0-b6e30f94b3f6.jpg",
};

const TAIL_SIZE = 10;
const DISPLAY_WORKSPACE = "Example Workspace";
const PREFILL_CATEGORY = "My Tasks";
const PREFILL_TASK = "Start my morning routine";
const CONGRATS_MESSAGE = "its beak, one of the founders of kindred. welcome :) you just completed your first task!";

export default function TutorialOnboarding() {
    const ThemedColor = useThemeColor();
    const insets = useSafeAreaInsets();
    const { onboardingData } = useOnboarding();
    const isSocialAuth = !!(onboardingData.appleId || onboardingData.googleId);
    const totalSteps = isSocialAuth ? 4 : 5;
    const router = useRouter();
    const { capture } = useAnalytics();
    const { user } = useAuth();
    const { workspaces, fetchWorkspaces, setSelected, setCreateCategory, categories, selected, addToCategory } = useTasks();
    const { setTaskName, resetTaskCreation } = useTaskCreation();
    const { request } = useRequest();

    const [step, setStep] = useState(0);
    const [showConfetti, setShowConfetti] = useState(false);
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

    // Congrats animation
    const bubbleOpacity = useRef(new Animated.Value(0)).current;
    const bubbleTranslateX = useRef(new Animated.Value(-28)).current;
    const avatarOpacity = useRef(new Animated.Value(0)).current;
    const buttonOpacity = useRef(new Animated.Value(0)).current;

    const confettiRef = useRef<any>(null);

    // ─── Init ───────────────────────────────────────────────────────
    useEffect(() => {
        const init = async () => {
            try { await setupDefaultWorkspace(); } catch {}
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

    // ─── Swipe hint nudge for step 2 ────────────────────────────────
    useEffect(() => {
        if (step !== 2) return;
        const hintTimeout = setTimeout(() => {
            Animated.sequence([
                Animated.timing(swipeHintAnim, {
                    toValue: 60, duration: 500, useNativeDriver: true,
                }),
                Animated.spring(swipeHintAnim, {
                    toValue: 0, friction: 6, tension: 40, useNativeDriver: true,
                }),
            ]).start();
        }, 1800);
        return () => clearTimeout(hintTimeout);
    }, [step]);

    // ─── Step 0: Category created ───────────────────────────────────
    const handleCategoryCreated = useCallback((id: string, name: string) => {
        setCategoryId(id);
        setCategoryName(name);
        setIsCreatingCategory(false);

        setTimeout(() => setStep(1), 400);
    }, []);

    const handleCancelCategory = useCallback(() => {
        setIsCreatingCategory(false);
    }, []);

    const handleStartCreatingCategory = useCallback(() => {
        setIsCreatingCategory(true);
    }, []);

    // ─── Step 1: Tap category to open create modal ──────────────────
    const handleCategoryPress = useCallback(() => {
        if (step === 1 && categoryId && categoryName) {
            resetTaskCreation();
            setTaskName(PREFILL_TASK);
            setCreateCategory({ label: categoryName, id: categoryId, special: false });
            setShowCreateModal(true);
        }
    }, [step, categoryId, categoryName]);

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
                if (step === 1) {
                    setTimeout(() => setStep(2), 300);
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
        if (showCreateModal || step !== 1 || !categoryId || taskData) return;
        if (!createModalShownRef.current) return;
        const timer = setTimeout(() => {
            fetchWorkspaces(true);
        }, 2000);
        return () => clearTimeout(timer);
    }, [showCreateModal, step, categoryId, taskData, fetchWorkspaces]);

    // ─── Step 2: Detect swipe completion ──────────────────────────────
    const [typedText, setTypedText] = useState("");
    const completionHandledRef = useRef(false);

    useEffect(() => {
        if (step !== 2 || !categoryId || !taskData || completionHandledRef.current) return;

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

            // Send a real congratulation + local notification
            sendCongratulation();

            setShowConfetti(true);
            if (Platform.OS === "ios") {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            setTimeout(() => {
                setStep(3);
                // Delay before showing the congrats card
                setTimeout(() => {
                    Animated.parallel([
                        Animated.timing(avatarOpacity, {
                            toValue: 1, duration: 200, useNativeDriver: true,
                        }),
                        Animated.timing(bubbleOpacity, {
                            toValue: 1, duration: 220, useNativeDriver: true,
                        }),
                        Animated.spring(bubbleTranslateX, {
                            toValue: 0, stiffness: 280, damping: 26, mass: 0.8, useNativeDriver: true,
                        }),
                    ]).start();
                    // Start typewriter after bubble slides in
                    setTimeout(() => startTypewriter(), 400);
                    Animated.timing(buttonOpacity, {
                        toValue: 1, duration: 400, delay: 1800, useNativeDriver: true,
                    }).start();
                }, 1000);
            }, 1500);
        }
    }, [categories, workspaces, categoryId, taskData, step]);

    // Send a real congratulation from beak via backend endpoint + push notification
    const sendCongratulation = () => {
        request("POST", "/user/congratulations/beak", {
            message: CONGRATS_MESSAGE,
            categoryName: categoryName ?? PREFILL_CATEGORY,
            taskName: taskData?.content ?? PREFILL_TASK,
        }).catch(() => {}); // fire-and-forget
    };

    // Typewriter effect for congrats message
    const startTypewriter = () => {
        let i = 0;
        const interval = setInterval(() => {
            i++;
            setTypedText(CONGRATS_MESSAGE.slice(0, i));
            if (i >= CONGRATS_MESSAGE.length) {
                clearInterval(interval);
            }
        }, 18);
    };

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
            />

            {/* Workspace area — mimics real WorkspaceContent layout */}
            <View style={[styles.workspaceArea, { paddingTop: insets.top + 40 }]}>
                <View style={{ paddingHorizontal: HORIZONTAL_PADDING }}>
                    {/* Workspace header — same as WorkspaceContent */}
                    <View style={styles.workspaceHeader}>
                        <ThemedText type="title" style={{ fontWeight: "600" }}>
                            {DISPLAY_WORKSPACE}
                        </ThemedText>
                    </View>

                    {/* Categories container — matches categoriesContainer gap: 16 */}
                    <View style={styles.categoriesContainer}>
                        {/* InlineCategoryCreator — wait for selected workspace */}
                        {isCreatingCategory && selected === ONBOARDING_WORKSPACE && (
                            <InlineCategoryCreator
                                initialName={step === 0 ? PREFILL_CATEGORY : undefined}
                                onCreated={handleCategoryCreated}
                                onCancel={handleCancelCategory}
                            />
                        )}

                        {/* Created category — uses real Category layout pattern */}
                        {step >= 1 && categoryId && categoryName && (
                            <View style={styles.categoryItemContainer}>
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

                                {/* Task — real SwipableTaskCard wrapped in nudge */}
                                {step >= 2 && taskData && (
                                    <Animated.View style={{ transform: [{ translateX: swipeHintAnim }] }}>
                                        <SwipableTaskCard
                                            categoryId={categoryId}
                                            task={taskData}
                                            categoryName={categoryName}
                                            redirect={false}
                                        />
                                    </Animated.View>
                                )}
                            </View>
                        )}

                        {/* + Add Category button — matches real workspace */}
                        {!isCreatingCategory && step === 0 && (
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

                {/* Step 3: Congrats from beak — shown in the workspace area */}
                {step === 3 && (
                    <View style={{ paddingHorizontal: HORIZONTAL_PADDING, marginTop: 32 }}>
                        <Animated.View style={{ opacity: bubbleOpacity, marginBottom: 16 }}>
                            <ThemedText type="caption" style={{ color: ThemedColor.primary, fontFamily: "Outfit", fontWeight: "600", fontSize: 13, letterSpacing: 0.5, textTransform: "uppercase" }}>
                                Congratulation
                            </ThemedText>
                        </Animated.View>
                        <View style={styles.kudosRow}>
                            <Animated.View style={{ opacity: avatarOpacity }}>
                                <View style={styles.avatarSection}>
                                    <CachedImage
                                        source={{ uri: BEAK.picture }}
                                        fallbackSource={require("@/assets/images/head.png")}
                                        variant="thumbnail"
                                        cachePolicy="memory-disk"
                                        style={styles.avatar}
                                    />
                                    <ThemedText style={[styles.avatarName, { color: ThemedColor.caption }]}>
                                        {BEAK.name}
                                    </ThemedText>
                                </View>
                            </Animated.View>

                            <Animated.View style={[styles.bubbleWrapper, {
                                opacity: bubbleOpacity,
                                transform: [{ translateX: bubbleTranslateX }],
                            }]}>
                                <View style={[styles.bubbleTail, { borderRightColor: ThemedColor.lightenedCard }]} />
                                <View style={[styles.bubbleCard, { backgroundColor: ThemedColor.lightenedCard }]}>
                                    <View style={styles.taskInfoRow}>
                                        <ThemedText style={[styles.taskInfoCategory, { color: ThemedColor.primary }]}>
                                            {categoryName ?? PREFILL_CATEGORY}
                                        </ThemedText>
                                        <View style={[styles.taskInfoDot, { backgroundColor: ThemedColor.caption }]} />
                                        <ThemedText style={[styles.taskInfoName, { color: ThemedColor.primary }]}>
                                            {taskData?.content ?? PREFILL_TASK}
                                        </ThemedText>
                                    </View>
                                    <ThemedText style={[styles.messageText, { color: ThemedColor.text }]}>
                                        {typedText}
                                    </ThemedText>
                                </View>
                            </Animated.View>
                        </View>
                    </View>
                )}
            </View>

            {/* Bottom prompt card */}
            <View style={styles.promptArea}>
                {step < 3 && prompts[step]?.title ? (
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
                    </Animated.View>
                ) : null}

                {step === 3 && (
                    <Animated.View style={[styles.promptCard, { opacity: buttonOpacity, backgroundColor: ThemedColor.lightened }]}>
                        <ThemedText style={[styles.promptSubtitle, { color: ThemedColor.caption, textAlign: "center", marginBottom: 12 }]}>
                            When you complete tasks, your friends can congratulate you
                        </ThemedText>
                        <PrimaryButton title="Continue" onPress={handleContinue} />
                    </Animated.View>
                )}
            </View>
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
        fontWeight: "300",
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
        fontWeight: "600",
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

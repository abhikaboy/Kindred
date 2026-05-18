import {
    Dimensions,
    StyleSheet,
    View,
    Animated,
    Platform,
} from "react-native";
import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { BlurView } from "expo-blur";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import Reanimated, {
    SharedValue,
    useAnimatedStyle,
    useAnimatedReaction,
    runOnJS,
} from "react-native-reanimated";
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
import { markAsCompletedAPI } from "@/api/task";
import { setupDefaultWorkspace } from "@/api/category";
import { ONBOARDING_WORKSPACE } from "@/constants/spotlightConfig";
import { useTasks } from "@/contexts/tasksContext";
import CachedImage from "@/components/CachedImage";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

const BEAK = {
    name: "beak",
    picture:
        "https://kindred.nyc3.digitaloceanspaces.com/profiles/67eef59f4931ee7a9fb630e5/ba16e335-bd38-4a0a-b5c0-b6e30f94b3f6.jpg",
};

const TAIL_SIZE = 10;

const STEP_CONTENT = [
    {
        title: "This is your workspace",
        subtitle: "Workspaces help you organize different areas of your life",
        button: "Next",
    },
    {
        title: "Tasks live inside categories",
        subtitle: "You can create categories to group related tasks",
        button: "Next",
    },
    {
        title: "Swipe right to complete",
        subtitle: "When you're done with a task, swipe it away",
        button: null,
    },
    {
        title: null,
        subtitle: null,
        button: "Continue",
    },
];

export default function TutorialOnboarding() {
    const ThemedColor = useThemeColor();
    const { onboardingData } = useOnboarding();
    const isSocialAuth = !!(onboardingData.appleId || onboardingData.googleId);
    const totalSteps = isSocialAuth ? 4 : 5;
    const router = useRouter();
    const { capture } = useAnalytics();
    const { workspaces, fetchWorkspaces } = useTasks();

    const [step, setStep] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [showConfetti, setShowConfetti] = useState(false);
    const [taskData, setTaskData] = useState<{
        categoryId: string;
        taskId: string;
    } | null>(null);

    // Step transition animations
    const titleOpacity = useRef(new Animated.Value(0)).current;
    const titleSlide = useRef(new Animated.Value(20)).current;
    const contentOpacity = useRef(new Animated.Value(0)).current;
    const contentSlide = useRef(new Animated.Value(30)).current;
    const buttonOpacity = useRef(new Animated.Value(0)).current;

    // Swipe hint animation (step 2)
    const swipeHintAnim = useRef(new Animated.Value(0)).current;

    // Congrats bubble animation (step 3)
    const bubbleOpacity = useRef(new Animated.Value(0)).current;
    const bubbleTranslateX = useRef(new Animated.Value(-28)).current;
    const avatarOpacity = useRef(new Animated.Value(0)).current;

    const confettiRef = useRef<any>(null);

    // Fetch workspaces on mount
    useEffect(() => {
        setupDefaultWorkspace().catch(() => {});
        fetchWorkspaces(true);
    }, []);

    // React to workspaces loading
    useEffect(() => {
        if (workspaces.length === 0) return;
        const guideWorkspace = workspaces.find(
            (w) => w.name === ONBOARDING_WORKSPACE
        );
        if (guideWorkspace) {
            const startingCategory = guideWorkspace.categories?.find(
                (c) => c.name === "Starting"
            );
            if (startingCategory && startingCategory.tasks?.length > 0) {
                setTaskData({
                    categoryId: startingCategory.id,
                    taskId: startingCategory.tasks[0].id,
                });
                setIsLoading(false);
            }
        }
    }, [workspaces]);

    // Analytics: track step view
    useEffect(() => {
        capture(AnalyticsEvents.ONBOARDING_STEP_VIEWED, {
            step_name: OnboardingSteps.TUTORIAL.name,
            step_index: OnboardingSteps.TUTORIAL.index,
        });
    }, []);

    // Animate in when step changes
    useEffect(() => {
        // Reset
        titleOpacity.setValue(0);
        titleSlide.setValue(20);
        contentOpacity.setValue(0);
        contentSlide.setValue(30);
        buttonOpacity.setValue(0);

        // Title: fade + slide (500ms, 200ms delay)
        Animated.parallel([
            Animated.timing(titleOpacity, {
                toValue: 1,
                duration: 500,
                delay: 200,
                useNativeDriver: true,
            }),
            Animated.timing(titleSlide, {
                toValue: 0,
                duration: 500,
                delay: 200,
                useNativeDriver: true,
            }),
        ]).start();

        // Content: fade + slide (600ms, 400ms delay)
        Animated.parallel([
            Animated.timing(contentOpacity, {
                toValue: 1,
                duration: 600,
                delay: 400,
                useNativeDriver: true,
            }),
            Animated.timing(contentSlide, {
                toValue: 0,
                duration: 600,
                delay: 400,
                useNativeDriver: true,
            }),
        ]).start();

        // Button: fade (400ms, 800ms delay)
        Animated.timing(buttonOpacity, {
            toValue: 1,
            duration: 400,
            delay: 800,
            useNativeDriver: true,
        }).start();
    }, [step]);

    // Swipe hint for step 2
    useEffect(() => {
        if (step !== 2) return;
        const hintTimeout = setTimeout(() => {
            Animated.sequence([
                Animated.timing(swipeHintAnim, {
                    toValue: 60,
                    duration: 500,
                    useNativeDriver: true,
                }),
                Animated.spring(swipeHintAnim, {
                    toValue: 0,
                    friction: 6,
                    tension: 40,
                    useNativeDriver: true,
                }),
            ]).start();
        }, 1800);
        return () => clearTimeout(hintTimeout);
    }, [step]);

    const handleSwipeComplete = async () => {
        setShowConfetti(true);

        if (Platform.OS === "ios") {
            await Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success
            );
        }

        // Fire API call (non-blocking)
        if (taskData) {
            markAsCompletedAPI(taskData.categoryId, taskData.taskId, {
                timeCompleted: new Date().toISOString(),
                timeTaken: 0,
            }).catch(() => {});
        }

        // After 1.2s, transition to step 3
        setTimeout(() => {
            setStep(3);

            // After another 0.6s, animate in the congrats bubble
            setTimeout(() => {
                Animated.parallel([
                    Animated.timing(avatarOpacity, {
                        toValue: 1,
                        duration: 200,
                        useNativeDriver: true,
                    }),
                    Animated.timing(bubbleOpacity, {
                        toValue: 1,
                        duration: 220,
                        useNativeDriver: true,
                    }),
                    Animated.spring(bubbleTranslateX, {
                        toValue: 0,
                        stiffness: 280,
                        damping: 26,
                        mass: 0.8,
                        useNativeDriver: true,
                    }),
                ]).start();
            }, 600);
        }, 1200);
    };

    const handleContinue = () => {
        capture(AnalyticsEvents.ONBOARDING_STEP_COMPLETED, {
            step_name: OnboardingSteps.TUTORIAL.name,
            step_index: OnboardingSteps.TUTORIAL.index,
        });
        router.push("/(onboarding)/calendar");
    };

    // Loading state
    if (isLoading) {
        return (
            <ThemedView style={styles.mainContainer}>
                <OnboardingProgressBar
                    currentStep={totalSteps}
                    totalSteps={totalSteps}
                />
            </ThemedView>
        );
    }

    return (
        <ThemedView style={styles.mainContainer}>
            <OnboardingProgressBar
                currentStep={totalSteps}
                totalSteps={totalSteps}
            />

            {/* Confetti */}
            {showConfetti && (
                <View style={styles.confettiContainer}>
                    <ConfettiCannon
                        ref={confettiRef}
                        count={50}
                        origin={{
                            x: screenWidth / 2,
                            y: (screenHeight / 4) * 3.7,
                        }}
                        fallSpeed={1200}
                        explosionSpeed={300}
                        fadeOut={true}
                    />
                </View>
            )}

            <View style={styles.contentContainer}>
                {/* Title + Subtitle */}
                {STEP_CONTENT[step].title && (
                    <Animated.View
                        style={[
                            styles.headerContainer,
                            {
                                opacity: titleOpacity,
                                transform: [{ translateY: titleSlide }],
                            },
                        ]}
                    >
                        <ThemedText
                            style={[
                                styles.title,
                                { color: ThemedColor.text },
                            ]}
                        >
                            {STEP_CONTENT[step].title}
                        </ThemedText>
                        {STEP_CONTENT[step].subtitle && (
                            <ThemedText
                                style={[
                                    styles.subtitle,
                                    { color: ThemedColor.caption },
                                ]}
                            >
                                {STEP_CONTENT[step].subtitle}
                            </ThemedText>
                        )}
                    </Animated.View>
                )}

                {/* Step content */}
                <Animated.View
                    style={[
                        styles.stepContent,
                        {
                            opacity: contentOpacity,
                            transform: [{ translateY: contentSlide }],
                        },
                    ]}
                >
                    {step === 0 && (
                        <Step0Workspace ThemedColor={ThemedColor} />
                    )}
                    {step === 1 && <Step1Task ThemedColor={ThemedColor} />}
                    {step === 2 && (
                        <Step2Swipe
                            ThemedColor={ThemedColor}
                            swipeHintAnim={swipeHintAnim}
                            onSwipeComplete={handleSwipeComplete}
                        />
                    )}
                    {step === 3 && (
                        <Step3Congrats
                            ThemedColor={ThemedColor}
                            avatarOpacity={avatarOpacity}
                            bubbleOpacity={bubbleOpacity}
                            bubbleTranslateX={bubbleTranslateX}
                        />
                    )}
                </Animated.View>

                {/* Spacer */}
                <View style={{ flex: 1 }} />

                {/* Button */}
                {STEP_CONTENT[step].button && (
                    <Animated.View style={{ opacity: buttonOpacity }}>
                        <PrimaryButton
                            title={STEP_CONTENT[step].button!}
                            onPress={
                                step === 3
                                    ? handleContinue
                                    : () => setStep(step + 1)
                            }
                        />
                    </Animated.View>
                )}
            </View>
        </ThemedView>
    );
}

// ─── Step 0: Workspace + Category reveal ─────────────────────────────────────

function Step0Workspace({ ThemedColor }: { ThemedColor: any }) {
    return (
        <View style={styles.cardsContainer}>
            {/* Workspace card */}
            <View
                style={[
                    styles.workspaceCard,
                    {
                        backgroundColor: ThemedColor.lightened,
                        borderColor: ThemedColor.tertiary,
                    },
                ]}
            >
                <ThemedText style={styles.workspaceEmoji}>🌺</ThemedText>
                <ThemedText
                    style={[
                        styles.workspaceName,
                        { color: ThemedColor.text },
                    ]}
                >
                    Kindred Guide
                </ThemedText>
            </View>

            {/* Category card (indented) */}
            <View
                style={[
                    styles.categoryCard,
                    {
                        borderColor: ThemedColor.tertiary,
                    },
                ]}
            >
                <ThemedText
                    style={[
                        styles.categoryName,
                        { color: ThemedColor.primary },
                    ]}
                >
                    Starting
                </ThemedText>
            </View>
        </View>
    );
}

// ─── Step 1: Task card inside category ───────────────────────────────────────

function Step1Task({ ThemedColor }: { ThemedColor: any }) {
    return (
        <View style={styles.cardsContainer}>
            {/* Category card */}
            <View
                style={[
                    styles.categoryCard,
                    {
                        borderColor: ThemedColor.tertiary,
                        marginLeft: 0,
                    },
                ]}
            >
                <ThemedText
                    style={[
                        styles.categoryName,
                        { color: ThemedColor.primary },
                    ]}
                >
                    Starting
                </ThemedText>
            </View>

            {/* Task card */}
            <View
                style={[
                    styles.taskCard,
                    {
                        backgroundColor: ThemedColor.lightened,
                        borderColor: ThemedColor.primary + "40",
                        borderWidth: 1.5,
                    },
                ]}
            >
                <View style={styles.taskRow}>
                    <View
                        style={[
                            styles.priorityDot,
                            { backgroundColor: ThemedColor.success },
                        ]}
                    />
                    <ThemedText
                        style={[
                            styles.taskText,
                            { color: ThemedColor.text },
                        ]}
                    >
                        Swipe to mark a task as complete
                    </ThemedText>
                </View>
            </View>
        </View>
    );
}

// ─── Step 2: Swipeable task ──────────────────────────────────────────────────

function Step2Swipe({
    ThemedColor,
    swipeHintAnim,
    onSwipeComplete,
}: {
    ThemedColor: any;
    swipeHintAnim: Animated.Value;
    onSwipeComplete: () => void;
}) {
    return (
        <View style={styles.cardsContainer}>
            {/* Blur overlay behind the swipe area */}
            <View style={styles.blurContainer}>
                <BlurView
                    intensity={15}
                    tint="default"
                    style={StyleSheet.absoluteFill}
                />
            </View>

            <Animated.View
                style={{
                    transform: [{ translateX: swipeHintAnim }],
                }}
            >
                <ReanimatedSwipeable
                    friction={1.3}
                    rightThreshold={100}
                    renderLeftActions={(prog, drag) =>
                        LeftAction(prog, drag, onSwipeComplete, ThemedColor)
                    }
                >
                    <View
                        style={[
                            styles.taskCard,
                            {
                                backgroundColor: ThemedColor.lightened,
                                borderColor: ThemedColor.primary + "40",
                                borderWidth: 1.5,
                            },
                        ]}
                    >
                        <View style={styles.taskRow}>
                            <View
                                style={[
                                    styles.priorityDot,
                                    { backgroundColor: ThemedColor.success },
                                ]}
                            />
                            <ThemedText
                                style={[
                                    styles.taskText,
                                    { color: ThemedColor.text },
                                ]}
                            >
                                Swipe to mark a task as complete
                            </ThemedText>
                        </View>
                    </View>
                </ReanimatedSwipeable>
            </Animated.View>

            <ThemedText
                style={[styles.swipeHintText, { color: ThemedColor.caption }]}
            >
                Swipe the task to complete it →
            </ThemedText>
        </View>
    );
}

// ─── Step 3: Congrats speech bubble ──────────────────────────────────────────

function Step3Congrats({
    ThemedColor,
    avatarOpacity,
    bubbleOpacity,
    bubbleTranslateX,
}: {
    ThemedColor: any;
    avatarOpacity: Animated.Value;
    bubbleOpacity: Animated.Value;
    bubbleTranslateX: Animated.Value;
}) {
    return (
        <View style={styles.congratsContainer}>
            {/* Beak avatar + bubble row */}
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
                        <ThemedText
                            style={[
                                styles.avatarName,
                                { color: ThemedColor.caption },
                            ]}
                        >
                            {BEAK.name}
                        </ThemedText>
                    </View>
                </Animated.View>

                {/* Speech bubble */}
                <Animated.View
                    style={[
                        styles.bubbleWrapper,
                        {
                            opacity: bubbleOpacity,
                            transform: [{ translateX: bubbleTranslateX }],
                        },
                    ]}
                >
                    <View
                        style={[
                            styles.bubbleTail,
                            {
                                borderRightColor: ThemedColor.lightenedCard,
                            },
                        ]}
                    />
                    <View
                        style={[
                            styles.bubbleCard,
                            {
                                backgroundColor: ThemedColor.lightenedCard,
                            },
                        ]}
                    >
                        {/* Task info row */}
                        <View style={styles.taskInfoRow}>
                            <ThemedText
                                style={[
                                    styles.taskInfoCategory,
                                    { color: ThemedColor.primary },
                                ]}
                            >
                                Starting
                            </ThemedText>
                            <View
                                style={[
                                    styles.taskInfoDot,
                                    {
                                        backgroundColor: ThemedColor.caption,
                                    },
                                ]}
                            />
                            <ThemedText
                                style={[
                                    styles.taskInfoName,
                                    { color: ThemedColor.primary },
                                ]}
                            >
                                Swipe to mark a task as complete
                            </ThemedText>
                        </View>

                        {/* Message */}
                        <ThemedText
                            style={[
                                styles.messageText,
                                { color: ThemedColor.text },
                            ]}
                        >
                            its beak, one of the founders of kindred. welcome :)
                            you just completed your first task!
                        </ThemedText>
                    </View>
                </Animated.View>
            </View>

            {/* Explainer text */}
            <ThemedText
                style={[styles.explainerText, { color: ThemedColor.caption }]}
            >
                When you complete tasks, your friends can congratulate you
            </ThemedText>
        </View>
    );
}

// ─── LeftAction (copied from accomplishment.tsx) ─────────────────────────────

function LeftAction(
    prog: SharedValue<number>,
    drag: SharedValue<number>,
    onComplete: () => void,
    ThemedColor: any
) {
    let width = Dimensions.get("window").width;
    const [isCompleting, setIsCompleting] = React.useState(false);

    useAnimatedReaction(
        () => drag.value,
        (currentValue) => {
            let threshold = width / 4;
            let percent = (currentValue - threshold * 3) / threshold;
            let opacity = 1 - percent;

            if (opacity <= 0 && !isCompleting) {
                runOnJS(setIsCompleting)(true);
                runOnJS(onComplete)();
            }
        }
    );

    const styleAnimation = useAnimatedStyle(() => {
        let threshold = width / 4;
        let percent = (drag.value - threshold * 3) / threshold;
        let opacity = 1 - percent;

        return {
            transform: [{ translateX: drag.value - width }],
            opacity: opacity,
            display: opacity > 0 ? "flex" : "none",
        };
    });

    return (
        <Reanimated.View
            style={[
                styleAnimation,
                {
                    backgroundColor: ThemedColor.success,
                    width: width,
                    justifyContent: "center",
                    alignItems: "center",
                },
            ]}
        />
    );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    mainContainer: {
        flex: 1,
        position: "relative",
    },
    confettiContainer: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10,
        height: screenHeight,
    },
    contentContainer: {
        flex: 1,
        paddingHorizontal: HORIZONTAL_PADDING,
        paddingTop: screenHeight * 0.15,
        paddingBottom: 40,
        zIndex: 1,
    },
    headerContainer: {
        marginBottom: 32,
    },
    title: {
        fontSize: 32,
        fontFamily: "Fraunces",
        fontWeight: "600",
        lineHeight: 38,
        letterSpacing: -1,
    },
    subtitle: {
        fontSize: 16,
        fontFamily: "Outfit",
        fontWeight: "300",
        lineHeight: 22,
        marginTop: 10,
    },
    stepContent: {
        gap: 0,
    },

    // ── Cards (Steps 0-2) ────────────────────────────────────────────────
    cardsContainer: {
        gap: 12,
    },
    workspaceCard: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        borderRadius: 14,
        borderWidth: 1,
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    workspaceEmoji: {
        fontSize: 22,
    },
    workspaceName: {
        fontSize: 17,
        fontFamily: "Outfit",
        fontWeight: "500",
    },
    categoryCard: {
        marginLeft: 20,
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    categoryName: {
        fontSize: 16,
        fontFamily: "Outfit",
        fontWeight: "600",
    },
    taskCard: {
        borderRadius: 16,
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    taskRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    priorityDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    taskText: {
        fontSize: 16,
        fontFamily: "Outfit",
        fontWeight: "300",
        flex: 1,
    },
    swipeHintText: {
        fontSize: 14,
        fontFamily: "Outfit",
        fontWeight: "300",
        marginTop: 4,
    },
    blurContainer: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 16,
        overflow: "hidden",
        zIndex: -1,
    },

    // ── Congrats (Step 3) ────────────────────────────────────────────────
    congratsContainer: {
        gap: 28,
    },
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
        width: 0,
        height: 0,
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
        width: 3,
        height: 3,
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
    explainerText: {
        fontSize: 14,
        fontFamily: "Outfit",
        fontWeight: "300",
        textAlign: "center",
    },
});

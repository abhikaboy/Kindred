import { Dimensions, StyleSheet, View, Animated, TouchableOpacity } from "react-native";
import React, { useEffect, useRef, useState } from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useRouter } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { OnboardingBackground } from "@/components/onboarding/BackgroundGraphics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import Reanimated, { SharedValue, useAnimatedStyle, useAnimatedReaction, runOnJS } from "react-native-reanimated";
import Ionicons from "@expo/vector-icons/Ionicons";
import Feather from "@expo/vector-icons/Feather";
import Octicons from "@expo/vector-icons/Octicons";
import ConfettiCannon from 'react-native-confetti-cannon';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const RIGHT_ACTION_WIDTH = 75;

type Props = {};

// Left action (Complete - green background)
function LeftAction(
    prog: SharedValue<number>,
    drag: SharedValue<number>,
    ThemedColor: any,
    onComplete: () => void
) {
    const [isCompleting, setIsCompleting] = React.useState(false);

    // Use useAnimatedReaction to watch the drag value
    useAnimatedReaction(
        () => drag.value,
        (currentValue) => {
            let threshold = screenWidth / 4;
            let percent = (currentValue - threshold * 3) / threshold;
            let opacity = 1 - percent;

            if (opacity <= 0 && !isCompleting) {
                runOnJS(setIsCompleting)(true);
                runOnJS(onComplete)(); // Trigger completion
            }
        }
    );

    const styleAnimation = useAnimatedStyle(() => {
        let threshold = screenWidth / 4;
        let percent = (drag.value - threshold * 3) / threshold;
        let opacity = 1 - percent;

        return {
            transform: [{ translateX: drag.value - screenWidth }],
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
                    width: screenWidth,
                    justifyContent: "center",
                    alignItems: "center",
                },
            ]}
        />
    );
}

// Right actions (alarm, flag, trash)
function RightAction(
    prog: SharedValue<number>,
    drag: SharedValue<number>,
    index: number,
    icon: React.ReactNode,
    color: string,
    onSwipeLeft?: () => void
) {
    const [hasTriggered, setHasTriggered] = React.useState(false);

    // Detect when swiped left
    useAnimatedReaction(
        () => drag.value,
        (currentValue) => {
            if (currentValue < -50 && !hasTriggered && onSwipeLeft) {
                runOnJS(setHasTriggered)(true);
                runOnJS(onSwipeLeft)();
            }
        }
    );

    const styleAnimation = useAnimatedStyle(() => {
        return {
            transform: [{ translateX: drag.value + RIGHT_ACTION_WIDTH * index }],
        };
    });

    return (
        <Reanimated.View
            style={[
                styleAnimation,
                {
                    backgroundColor: color,
                    justifyContent: "center",
                    alignItems: "center",
                    width: RIGHT_ACTION_WIDTH,
                    height: '100%',
                }
            ]}
        >
            <TouchableOpacity onPress={() => {}} activeOpacity={0.7}>
                {icon}
            </TouchableOpacity>
        </Reanimated.View>
    );
}

const SwipeCompleteTutorialScreen = (props: Props) => {
    const ThemedColor = useThemeColor();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [showConfetti, setShowConfetti] = useState(false);
    const [hasSwipedLeft, setHasSwipedLeft] = useState(false);
    const [currentInstruction, setCurrentInstruction] = useState<'left' | 'right'>('left');

    // Animation values
    const fadeAnimation = useRef(new Animated.Value(0)).current;
    const slideAnimation = useRef(new Animated.Value(30)).current;
    const instructionOpacity = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        // Fade in animation on mount
        Animated.parallel([
            Animated.timing(fadeAnimation, {
                toValue: 1,
                duration: 640,
                delay: 160,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnimation, {
                toValue: 0,
                duration: 640,
                delay: 160,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    const handleSwipeLeft = () => {
        if (!hasSwipedLeft) {
            setHasSwipedLeft(true);
            // Fade out left instruction, then fade in right instruction
            Animated.sequence([
                Animated.timing(instructionOpacity, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.timing(instructionOpacity, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start(() => {
                setCurrentInstruction('right');
                Animated.timing(instructionOpacity, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }).start();
            });
        }
    };

    const handleComplete = () => {
        // Show confetti
        setShowConfetti(true);

        // Navigate to next page after confetti starts
        setTimeout(() => {
            router.push('/(logged-in)/(tutorial)/public-tasks');
        }, 1500);
    };

    return (
        <ThemedView style={styles.container}>
            {/* Background Graphics */}
            <OnboardingBackground />

            <Animated.View 
                style={[
                    styles.content,
                    {
                        opacity: fadeAnimation,
                        transform: [{ translateY: slideAnimation }],
                        paddingTop: insets.top + 20,
                        paddingBottom: insets.bottom + 20,
                    }
                ]}
            >
                {/* Spacer to push content to center */}
                <View style={styles.spacer} />

                {/* Swipeable Task Demo */}
                <View style={styles.demoContainer}>
                    {/* Instruction Text - Only one at a time */}
                    <Animated.View style={[styles.instructionContainer, { opacity: instructionOpacity }]}>
                        <ThemedText type="default" style={[styles.instructionText, { color: ThemedColor.caption }]}>
                            {currentInstruction === 'left' 
                                ? 'Swipe left to see more options' 
                                : 'Swipe right to complete'}
                        </ThemedText>
                    </Animated.View>

                    {/* Real Swipeable Task Card */}
                    <ReanimatedSwipeable
                        containerStyle={styles.swipeable}
                        friction={1}
                        enableTrackpadTwoFingerGesture
                        leftThreshold={screenWidth / 4}
                        overshootLeft={true}
                        overshootFriction={2.7}
                        renderLeftActions={(prog, drag) => LeftAction(prog, drag, ThemedColor, handleComplete)}
                        rightThreshold={100}
                        overshootRight={true}
                        renderRightActions={(prog, drag) => (
                            <View style={{ flexDirection: "row" }}>
                                {RightAction(
                                    prog,
                                    drag,
                                    3,
                                    <Ionicons name="alarm-outline" size={32} color="white" />,
                                    ThemedColor.primary,
                                    handleSwipeLeft
                                )}
                                {RightAction(
                                    prog,
                                    drag,
                                    3,
                                    <Feather name="flag" size={24} color="white" />,
                                    ThemedColor.primary
                                )}
                                {RightAction(
                                    prog,
                                    drag,
                                    3,
                                    <Octicons name="trash" size={24} color="white" />,
                                    ThemedColor.error
                                )}
                            </View>
                        )}
                    >
                        <View
                            style={[
                                styles.fakeTaskCard,
                                {
                                    backgroundColor: ThemedColor.lightened,
                                    borderColor: ThemedColor.tertiary,
                                }
                            ]}
                        >
                            <View style={styles.taskRow}>
                                <View style={styles.taskContentContainer}>
                                    <ThemedText numberOfLines={2} ellipsizeMode="tail" type="default" style={styles.taskText}>
                                        Buy groceries 🛒
                                    </ThemedText>
                                </View>
                                <View style={styles.taskIconRow}>
                                    <View style={[styles.priorityDot, { backgroundColor: ThemedColor.success }]} />
                                </View>
                            </View>
                        </View>
                    </ReanimatedSwipeable>
                </View>

                {/* Confetti - Aligned with how app handles it */}
                {showConfetti && (
                    <View
                        style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            zIndex: 10,
                            height: Dimensions.get("screen").height,
                        }}>
                        <ConfettiCannon
                            count={50}
                            origin={{
                                x: Dimensions.get("screen").width / 2,
                                y: (Dimensions.get("screen").height / 4) * 3.7,
                            }}
                            fallSpeed={1200}
                            explosionSpeed={300}
                            fadeOut={true}
                        />
                    </View>
                )}

                {/* Spacer to push title to bottom */}
                <View style={styles.spacer} />

                {/* Title at Bottom */}
                <View style={styles.titleContainer}>
                    <ThemedText type="titleFraunces" style={styles.title}>
                        Swipe the task to complete, or delete tasks
                    </ThemedText>
                </View>
            </Animated.View>
        </ThemedView>
    );
};

export default SwipeCompleteTutorialScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        position: 'relative',
    },
    content: {
        flex: 1,
        paddingHorizontal: HORIZONTAL_PADDING,
        position: 'relative',
        zIndex: 1,
    },
    demoContainer: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
    },
    instructionContainer: {
        alignItems: 'center',
        width: '100%',
    },
    instructionText: {
        fontSize: 16,
        textAlign: 'center',
        fontFamily: 'Outfit',
    },
    swipeable: {
        width: '100%',
    },
    fakeTaskCard: {
        width: screenWidth - HORIZONTAL_PADDING * 2,
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderRadius: 16,
        borderWidth: 1,
        justifyContent: 'center',
        minHeight: 72,
    },
    taskRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 6,
        minHeight: 20,
    },
    taskContentContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        width: '90%',
        margin: 'auto',
        gap: 6,
    },
    taskText: {
        textAlign: 'left',
        lineHeight: 24,
    },
    taskIconRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        minHeight: 20,
        height: '100%',
    },
    priorityDot: {
        width: 10,
        height: 10,
        borderRadius: 10,
    },
    titleContainer: {
        marginTop: 16,
        marginBottom: 32,
        paddingRight: 24,
    },
    title: {
        fontSize: 32,
        letterSpacing: -1,
        lineHeight: 38,
    },
    spacer: {
        flex: 1,
    },
});


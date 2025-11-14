import { Dimensions, StyleSheet, View, Animated, Platform } from "react-native";
import React, { useEffect, useRef, useState } from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useRouter } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import Reanimated, { SharedValue, useAnimatedStyle, useAnimatedReaction, runOnJS } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import ConfettiCannon from "react-native-confetti-cannon";
import { Svg, Circle, Path, Polygon } from "react-native-svg";

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

type Props = {};

const AccomplishmentOnboarding = (props: Props) => {
    const ThemedColor = useThemeColor();
    const router = useRouter();
    const confettiRef = useRef<any>(null);
    const [showConfetti, setShowConfetti] = useState(false);

    // Animation values
    const fadeAnimation = useRef(new Animated.Value(0)).current;
    const slideAnimation = useRef(new Animated.Value(30)).current;

    useEffect(() => {
        // Fade in animation on mount
        Animated.parallel([
            Animated.timing(fadeAnimation, {
                toValue: 1,
                duration: 800,
                delay: 240,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnimation, {
                toValue: 0,
                duration: 800,
                delay: 240,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    const handleComplete = async () => {
        setShowConfetti(true);
        
        if (Platform.OS === "ios") {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }

        // Navigate to the main app after a delay
        setTimeout(() => {
            router.replace('/(logged-in)/(tabs)/(task)' as any);
        }, 2000);
    };

    return (
        <ThemedView style={styles.mainContainer}>
            {/* Confetti */}
            {showConfetti && (
                <View
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 10,
                        height: screenHeight,
                    }}>
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

            {/* Background decorative elements */}
            <View style={styles.backgroundGraphics}>
                {/* Top left circle */}
                <Svg
                    width="112"
                    height="112"
                    viewBox="0 0 112 112"
                    style={styles.topLeftCircle}
                >
                    <Circle
                        cx="56"
                        cy="56"
                        r="55"
                        stroke={ThemedColor.primary}
                        strokeWidth="2"
                        strokeDasharray="10 10"
                        fill={ThemedColor.background}
                    />
                </Svg>

                {/* Top right triangle */}
                <Svg
                    width="85"
                    height="82"
                    viewBox="0 0 85 82"
                    style={styles.topRightTriangle}
                >
                    <Polygon
                        points="42.5,5 80,77 5,77"
                        fill={ThemedColor.primary}
                        opacity="0.15"
                    />
                </Svg>

                {/* Middle right star */}
                <Svg
                    width="145"
                    height="145"
                    viewBox="0 0 145 145"
                    style={styles.middleRightStar}
                >
                    <Path
                        d="M72.5 10L88.2 56.3L135 72L88.2 87.7L72.5 134L56.8 87.7L10 72L56.8 56.3L72.5 10Z"
                        fill={ThemedColor.primary}
                        opacity="0.1"
                    />
                </Svg>

                {/* Bottom left circle */}
                <Svg
                    width="172"
                    height="172"
                    viewBox="0 0 172 172"
                    style={styles.bottomLeftCircle}
                >
                    <Circle
                        cx="86"
                        cy="86"
                        r="85"
                        stroke={ThemedColor.primary}
                        strokeWidth="2"
                        strokeDasharray="10 10"
                        fill={ThemedColor.background}
                    />
                </Svg>

                {/* Bottom right square */}
                <Svg
                    width="85"
                    height="82"
                    viewBox="0 0 85 82"
                    style={styles.bottomRightSquare}
                >
                    <Path
                        d="M20 20L65 20L65 65L20 65Z"
                        fill={ThemedColor.primary}
                        opacity="0.15"
                        transform="rotate(30 42.5 42.5)"
                    />
                </Svg>

                {/* Bottom arrow */}
                <Svg
                    width="120"
                    height="60"
                    viewBox="0 0 120 60"
                    style={styles.bottomArrow}
                >
                    <Path
                        d="M10 10 Q40 40, 70 10 T110 40"
                        stroke={ThemedColor.tint}
                        strokeWidth="2"
                        strokeDasharray="8 8"
                        fill="none"
                    />
                    <Path
                        d="M100 30 L110 40 L100 50"
                        stroke={ThemedColor.tint}
                        strokeWidth="2"
                        fill="none"
                    />
                </Svg>
            </View>

            <View style={styles.contentContainer}>
                {/* Main Text Section */}
                <Animated.View 
                    style={[
                        styles.mainTextContainer,
                        {
                            opacity: fadeAnimation,
                            transform: [{ translateY: slideAnimation }],
                        }
                    ]}
                >
                    <ThemedText style={[styles.mainText, { color: ThemedColor.text }]}>
                        Let's celebrate your first accomplishment.
                    </ThemedText>
                </Animated.View>

                {/* Swipeable Task Card */}
                <Animated.View 
                    style={[
                        styles.taskContainer,
                        {
                            opacity: fadeAnimation,
                            transform: [{ translateY: slideAnimation }],
                        }
                    ]}
                >
                    <ReanimatedSwipeable
                        friction={1.3}
                        rightThreshold={100}
                        renderLeftActions={(prog, drag) => 
                            LeftAction(prog, drag, handleComplete, ThemedColor)
                        }
                    >
                        <View style={[
                            styles.taskCard, 
                            { 
                                backgroundColor: ThemedColor.lightened,
                                borderColor: ThemedColor.tertiary 
                            }
                        ]}>
                            <ThemedText style={[styles.taskText, { color: ThemedColor.text }]}>
                                Finish Kindred Onboarding
                            </ThemedText>
                        </View>
                    </ReanimatedSwipeable>

                    <ThemedText style={[styles.instructionText, { color: ThemedColor.caption }]}>
                        Swipe the task to Mark it Complete  →
                    </ThemedText>
                </Animated.View>

                {/* Spacer */}
                <View style={{ flex: 1 }} />
            </View>
        </ThemedView>
    );
};

function LeftAction(
    prog: SharedValue<number>,
    drag: SharedValue<number>,
    onComplete: () => void,
    ThemedColor: any
) {
    let width = Dimensions.get("window").width;
    const [isCompleting, setIsCompleting] = React.useState(false);

    // Use useAnimatedReaction to watch the drag value
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

const styles = StyleSheet.create({
    mainContainer: {
        flex: 1,
        position: 'relative',
    },
    contentContainer: {
        flex: 1,
        paddingHorizontal: HORIZONTAL_PADDING,
        paddingTop: screenHeight * 0.35,
        paddingBottom: 40,
        zIndex: 1,
    },
    backgroundGraphics: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 0,
    },
    topLeftCircle: {
        position: 'absolute',
        top: 67,
        left: -38,
    },
    topRightTriangle: {
        position: 'absolute',
        top: 134,
        right: 55,
    },
    middleRightStar: {
        position: 'absolute',
        top: screenHeight * 0.55,
        right: -50,
        transform: [{ rotate: '38.941deg' }],
    },
    bottomLeftCircle: {
        position: 'absolute',
        bottom: screenHeight * 0.15,
        left: -28,
    },
    bottomRightSquare: {
        position: 'absolute',
        bottom: 50,
        right: 25,
        transform: [{ rotate: '30deg' }],
    },
    bottomArrow: {
        position: 'absolute',
        bottom: screenHeight * 0.35,
        right: 20,
    },
    mainTextContainer: {
        marginBottom: 36,
    },
    mainText: {
        fontSize: 32,
        fontFamily: 'Fraunces',
        fontWeight: '600',
        lineHeight: 38,
        letterSpacing: -1,
    },
    taskContainer: {
        gap: 16,
    },
    taskCard: {
        borderRadius: 16,
        borderWidth: 1,
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    taskText: {
        fontSize: 16,
        fontFamily: 'Outfit',
        fontWeight: '300',
    },
    instructionText: {
        fontSize: 14,
        fontFamily: 'Outfit',
        fontWeight: '300',
    },
});

export default AccomplishmentOnboarding;


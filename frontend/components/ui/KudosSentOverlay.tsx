import React, { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Easing, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Check, PaperPlaneTilt } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import { useKudosSent } from "@/contexts/kudosSentContext";

const { height: SCREEN_HEIGHT } = Dimensions.get("screen");
const GRADIENT_HEIGHT = SCREEN_HEIGHT * 0.5;
const PRIMARY_COLOR = "#854DFF";

// Phased timings — mirror RingUpdateOverlay's "room dims, then content" beat.
//   0ms .. 900ms   : gradient fades in from the top
//   700ms .. 1180ms : card drops in + fades in
//   then hold ~1200ms, then fade everything out
const GRADIENT_ENTER_DURATION = 900;
const CARD_ENTER_DELAY = 700;
const CARD_ENTER_DURATION = 480;
const HOLD = 1200;
const CARD_EXIT_DURATION = 420;
const GRADIENT_EXIT_DELAY = 200;
const GRADIENT_EXIT_DURATION = 640;

export const KudosSentOverlay: React.FC = () => {
    const { current, onComplete } = useKudosSent();
    const insets = useSafeAreaInsets();

    const gradientOpacity = useRef(new Animated.Value(0)).current;
    const cardOpacity = useRef(new Animated.Value(0)).current;
    const cardTranslateY = useRef(new Animated.Value(-32)).current;

    const [mounted, setMounted] = useState(false);
    const hapticTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!current) return;

        setMounted(true);
        gradientOpacity.setValue(0);
        cardOpacity.setValue(0);
        cardTranslateY.setValue(-32);

        const enter = Animated.parallel([
            Animated.timing(gradientOpacity, {
                toValue: 1,
                duration: GRADIENT_ENTER_DURATION,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true,
            }),
            Animated.timing(cardOpacity, {
                toValue: 1,
                delay: CARD_ENTER_DELAY,
                duration: CARD_ENTER_DURATION,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true,
            }),
            Animated.timing(cardTranslateY, {
                toValue: 0,
                delay: CARD_ENTER_DELAY,
                duration: CARD_ENTER_DURATION + 60,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
        ]);

        const hold = Animated.delay(HOLD);

        const exit = Animated.parallel([
            Animated.timing(cardOpacity, {
                toValue: 0,
                duration: CARD_EXIT_DURATION,
                easing: Easing.in(Easing.ease),
                useNativeDriver: true,
            }),
            Animated.timing(cardTranslateY, {
                toValue: -32,
                duration: CARD_EXIT_DURATION,
                easing: Easing.in(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.timing(gradientOpacity, {
                toValue: 0,
                delay: GRADIENT_EXIT_DELAY,
                duration: GRADIENT_EXIT_DURATION,
                easing: Easing.in(Easing.ease),
                useNativeDriver: true,
            }),
        ]);

        // Fire a light success haptic as the card lands.
        hapticTimer.current = setTimeout(() => {
            Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success
            ).catch(() => {});
        }, CARD_ENTER_DELAY);

        const sequence = Animated.sequence([enter, hold, exit]);
        sequence.start(({ finished }) => {
            if (hapticTimer.current) {
                clearTimeout(hapticTimer.current);
                hapticTimer.current = null;
            }
            setMounted(false);
            if (finished) onComplete();
        });

        return () => {
            sequence.stop();
            if (hapticTimer.current) {
                clearTimeout(hapticTimer.current);
                hapticTimer.current = null;
            }
        };
    }, [current]);

    if (!mounted || !current) return null;

    const kindLabel =
        current.kind === "congratulation" ? "Congrats" : "Encouragement";

    return (
        <View style={styles.root} pointerEvents="none">
            <Animated.View
                style={[styles.gradientWrapper, { opacity: gradientOpacity }]}
            >
                <LinearGradient
                    colors={[
                        "rgba(0,0,0,0.92)",
                        "rgba(0,0,0,0.78)",
                        "rgba(0,0,0,0.28)",
                        "transparent",
                    ]}
                    locations={[0, 0.38, 0.72, 1]}
                    style={StyleSheet.absoluteFill}
                />
            </Animated.View>

            <Animated.View
                style={[
                    styles.content,
                    {
                        top: insets.top + 64,
                        opacity: cardOpacity,
                        transform: [{ translateY: cardTranslateY }],
                    },
                ]}
            >
                <View style={styles.iconBadge}>
                    <PaperPlaneTilt size={28} color={PRIMARY_COLOR} weight="fill" />
                </View>
                <View style={styles.sentRow}>
                    <Check size={16} color="#ffffff" weight="bold" />
                    <ThemedText style={styles.sentText}>Kudos sent!</ThemedText>
                </View>
                <ThemedText style={styles.recipientText}>
                    {kindLabel} to {current.recipientName}
                </ThemedText>
                {!!current.message && (
                    <View style={styles.messageCard}>
                        <ThemedText
                            style={styles.messageText}
                            numberOfLines={3}
                        >
                            {current.message}
                        </ThemedText>
                    </View>
                )}
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    root: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 99999,
        elevation: 99999,
    },
    gradientWrapper: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: GRADIENT_HEIGHT,
    },
    content: {
        position: "absolute",
        left: 24,
        right: 24,
        alignItems: "center",
        gap: 12,
    },
    iconBadge: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: "rgba(133,77,255,0.16)",
        alignItems: "center",
        justifyContent: "center",
    },
    sentRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    sentText: {
        color: "#ffffff",
        fontSize: 18,
        fontFamily: "Outfit",
        fontWeight: "600",
        letterSpacing: 0.2,
    },
    recipientText: {
        color: "rgba(255,255,255,0.72)",
        fontSize: 14,
        fontFamily: "Outfit",
        fontWeight: "500",
        textAlign: "center",
    },
    messageCard: {
        marginTop: 4,
        maxWidth: "100%",
        backgroundColor: "rgba(255,255,255,0.08)",
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.12)",
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    messageText: {
        color: "#ffffff",
        fontSize: 15,
        fontFamily: "Outfit",
        fontWeight: "400",
        textAlign: "center",
        lineHeight: 21,
    },
});

export default KudosSentOverlay;

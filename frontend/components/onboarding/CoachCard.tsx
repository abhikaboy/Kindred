import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { COACH_CARD_ELEVATION } from "@/utils/onboardingV2/coachLayers";
import { useThemeColor } from "@/hooks/useThemeColor";

type Props = {
    title: string;
    body?: string;
    /** Small leading dot in a meaningful color (a ring). */
    accentColor?: string;
    step?: { index: number; total: number };
    actionLabel?: string;
    onAction?: () => void;
    onSkip?: () => void;
    visible: boolean;
    testID?: string;
};

/** Guided-tour card: one Fraunces instruction, optional detail, progress dots on the left, Skip and action on the right. */
export const CoachCard = ({
    title,
    body,
    accentColor,
    step,
    actionLabel,
    onAction,
    onSkip,
    visible,
    testID = "onboarding-coach",
}: Props) => {
    const ThemedColor = useThemeColor();
    const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;

    useEffect(() => {
        Animated.timing(opacity, { toValue: visible ? 1 : 0, duration: 200, useNativeDriver: true }).start();
    }, [visible, opacity]);

    const showFooter = Boolean(onSkip) || Boolean(actionLabel);

    return (
        <Animated.View
            testID={testID}
            pointerEvents={visible ? "box-none" : "none"}
            style={[styles.container, { backgroundColor: ThemedColor.background, opacity }]}
        >
            <View style={styles.titleRow}>
                {accentColor ? <View testID={`${testID}-accent`} style={[styles.accent, { backgroundColor: accentColor }]} /> : null}
                <ThemedText type="fancyFrauncesSubheading" numberOfLines={2} testID={`${testID}-copy`} style={styles.title}>
                    {title}
                </ThemedText>
            </View>

            {body ? (
                <ThemedText type="lightBody" numberOfLines={3} style={{ color: ThemedColor.caption }}>
                    {body}
                </ThemedText>
            ) : null}

            {showFooter || step ? (
                <View style={styles.footer}>
                    {step ? (
                        <View testID={`${testID}-dots`} style={styles.dots}>
                            {Array.from({ length: step.total }, (_, i) => (
                                <View
                                    key={i}
                                    testID={`${testID}-dot-${i}`}
                                    style={[
                                        styles.dot,
                                        { backgroundColor: i <= step.index ? ThemedColor.primary : ThemedColor.tertiary },
                                    ]}
                                />
                            ))}
                        </View>
                    ) : (
                        <View />
                    )}
                    <View style={styles.actions}>
                        {onSkip ? (
                            <Pressable
                                testID={`${testID}-skip`}
                                accessibilityRole="button"
                                accessibilityLabel="Skip"
                                onPress={onSkip}
                                hitSlop={10}
                            >
                                <ThemedText type="caption" style={{ color: ThemedColor.caption }}>
                                    Skip
                                </ThemedText>
                            </Pressable>
                        ) : null}
                        {actionLabel ? (
                            <Pressable
                                testID={`${testID}-action`}
                                accessibilityRole="button"
                                accessibilityLabel={actionLabel}
                                onPress={onAction}
                                hitSlop={6}
                                style={[styles.action, { backgroundColor: ThemedColor.primary }]}
                            >
                                <ThemedText type="defaultSemiBold" style={{ color: ThemedColor.buttonText }}>
                                    {actionLabel}
                                </ThemedText>
                            </Pressable>
                        ) : null}
                    </View>
                </View>
            ) : null}
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignSelf: "stretch",
        alignItems: "flex-start",
        gap: 8,
        borderRadius: 20,
        padding: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
        elevation: COACH_CARD_ELEVATION,
    },
    titleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    title: {
        flexShrink: 1,
        textAlign: "left",
    },
    accent: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    actions: {
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
    },
    dots: {
        flexDirection: "row",
        gap: 6,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    footer: {
        alignSelf: "stretch",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 4,
        minHeight: 36,
    },
    action: {
        borderRadius: 999,
        paddingHorizontal: 18,
        paddingVertical: 8,
    },
});

export default CoachCard;

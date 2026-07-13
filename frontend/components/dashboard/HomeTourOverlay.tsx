import React, { useRef, useState } from "react";
import { Pressable, StyleSheet, useColorScheme, View } from "react-native";
import { BlurView } from "expo-blur";
import { ThemedText } from "@/components/ThemedText";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { useThemeColor } from "@/hooks/useThemeColor";

type Props = {
    active: boolean;
    activeSectionTop: number | null;
    copy: string;
    stepIndex: number;
    totalSteps: number;
    isCreateStep: boolean;
    onNext: () => void;
    onSkip: () => void;
    onCreate: () => void;
};

// The blur band + explainer card that ride over HomeScrollContent during the
// guided reveal. Everything above the active section is blurred; the active
// section (nothing is rendered below it yet) stays sharp.
export const HomeTourOverlay: React.FC<Props> = ({
    active,
    activeSectionTop,
    copy,
    stepIndex,
    totalSteps,
    isCreateStep,
    onNext,
    onSkip,
    onCreate,
}) => {
    const ThemedColor = useThemeColor();
    // "light"/"dark" reads as a clean frost; "default" casts muddy gray on light UIs.
    const tint = useColorScheme() === "dark" ? "dark" : "light";
    // activeSectionTop is a window Y; the overlay may start below the window top
    // (header/safe-area), so measure our own origin and blur in overlay space.
    const rootRef = useRef<View>(null);
    const [originY, setOriginY] = useState(0);
    if (!active) return null;

    const bandHeight = Math.max(0, (activeSectionTop ?? 0) - originY);

    return (
        <Pressable
            ref={rootRef}
            onLayout={() => rootRef.current?.measureInWindow((_x, y) => setOriginY(y))}
            onPress={isCreateStep ? undefined : onNext}
            // Above AnimatedView's visible zIndex (1) so taps reach the overlay.
            style={[StyleSheet.absoluteFill, { zIndex: 1000 }]}>

            {isCreateStep ? (
                <BlurView intensity={18} tint={tint} pointerEvents="none" style={StyleSheet.absoluteFill} />
            ) : bandHeight > 0 ? (
                <BlurView
                    intensity={12}
                    tint={tint}
                    pointerEvents="none"
                    style={{ position: "absolute", top: 0, left: 0, right: 0, height: bandHeight }}
                />
            ) : null}

            <View style={[styles.card, { backgroundColor: ThemedColor.background, borderColor: ThemedColor.tertiary }]}>
                <ThemedText type="defaultSemiBold" style={{ marginBottom: 10 }}>
                    {copy}
                </ThemedText>

                <View style={styles.dots}>
                    {Array.from({ length: totalSteps }).map((_, i) => (
                        <View
                            key={i}
                            style={[styles.dot, { backgroundColor: i <= stepIndex ? ThemedColor.primary : ThemedColor.tertiary }]}
                        />
                    ))}
                </View>

                {isCreateStep ? (
                    <View style={{ marginTop: 14, gap: 12 }}>
                        <PrimaryButton title="Create workspace" onPress={onCreate} />
                        <Pressable onPress={onSkip} hitSlop={10} style={{ alignItems: "center" }}>
                            <ThemedText type="caption" style={{ color: ThemedColor.caption }}>
                                Maybe later
                            </ThemedText>
                        </Pressable>
                    </View>
                ) : (
                    <View style={styles.footerRow}>
                        <Pressable onPress={onSkip} hitSlop={10}>
                            <ThemedText type="caption" style={{ color: ThemedColor.caption }}>
                                Skip
                            </ThemedText>
                        </Pressable>
                        <ThemedText type="caption" style={{ color: ThemedColor.primary }}>
                            Tap to continue →
                        </ThemedText>
                    </View>
                )}
            </View>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    card: {
        position: "absolute",
        left: 16,
        right: 16,
        bottom: 44,
        borderRadius: 20,
        borderWidth: 1,
        padding: 18,
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
    footerRow: {
        marginTop: 14,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
});

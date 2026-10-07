import React, { useEffect, useRef, useSyncExternalStore } from "react";
import { Modal, View, TouchableOpacity, StyleSheet, Dimensions } from "react-native";
import ConfettiCannon from "react-native-confetti-cannon";
import { Sparkle } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { hapticCompletionBurst } from "@/utils/haptics";

// A step finishing is worth a moment. The host lives on the screen, not the card,
// because finishing the last step removes the card mid-celebration.

export type StepDonePayload = {
    taskContent: string;
    next: string | null;
    onKeepGoing?: () => void;
    onDoneForNow?: () => void;
};

let current: StepDonePayload | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => {
        listeners.delete(l);
    };
};

export const showStepDone = (p: StepDonePayload) => {
    current = p;
    emit();
};
const hide = () => {
    current = null;
    emit();
};

// Brand colours only; nothing reads as red
const CONFETTI_COLORS = ["#854DFF", "#A77BFF", "#C9B0FF", "#5CFF95", "#FFD37A"];
const { width } = Dimensions.get("screen");

const StepDoneCelebration = () => {
    const payload = useSyncExternalStore(subscribe, () => current);
    const ThemedColor = useThemeColor();
    const shown = useRef<StepDonePayload | null>(null);
    if (payload) shown.current = payload;
    const p = payload ?? shown.current;

    useEffect(() => {
        if (payload) hapticCompletionBurst();
    }, [payload]);

    const act = (fn?: () => void) => {
        hide();
        fn?.();
    };

    return (
        <Modal visible={!!payload} transparent animationType="fade" onRequestClose={() => act(p?.onDoneForNow)}>
            <View style={[styles.fill, { backgroundColor: ThemedColor.background }]}>
                <Sparkle size={64} color={ThemedColor.primary} weight="fill" style={styles.burst} />
                <ThemedText type="titleFraunces" style={styles.center}>
                    Step done
                </ThemedText>
                {!!p && (
                    <ThemedText type="lightBody" style={[styles.center, { color: ThemedColor.caption, marginTop: 8 }]}>
                        {`${p.taskContent} is moving.`}
                    </ThemedText>
                )}
                <View style={styles.actions}>
                    {!!p?.next && (
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => act(p.onKeepGoing)}
                            style={[styles.button, { backgroundColor: ThemedColor.primary }]}
                        >
                            <ThemedText type="default" numberOfLines={1} style={{ color: ThemedColor.buttonText }}>
                                {`Keep going: ${p.next}`}
                            </ThemedText>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => act(p?.onDoneForNow)}
                        style={[styles.button, { backgroundColor: ThemedColor.lightened }]}
                    >
                        <ThemedText type="default" style={{ fontWeight: "400" }}>
                            Done for now
                        </ThemedText>
                    </TouchableOpacity>
                </View>
                {!!payload && (
                    <ConfettiCannon
                        count={60}
                        origin={{ x: width / 2, y: -16 }}
                        fallSpeed={2400}
                        explosionSpeed={320}
                        colors={CONFETTI_COLORS}
                        fadeOut
                    />
                )}
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    fill: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
    },
    burst: {
        marginBottom: 24,
    },
    center: {
        textAlign: "center",
    },
    actions: {
        alignSelf: "stretch",
        gap: 12,
        marginTop: 48,
    },
    button: {
        height: 48,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 16,
    },
});

export default StepDoneCelebration;

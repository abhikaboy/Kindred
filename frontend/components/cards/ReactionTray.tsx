import React, { useEffect } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import { KUDOS_REACTION_EMOJIS, KudosReactionEmoji } from "@/constants/kudos";
import { useThemeColor } from "@/hooks/useThemeColor";

interface ReactionTrayProps {
    visible: boolean;
    currentReaction?: string | null;
    onSelect: (emoji: KudosReactionEmoji) => void;
    onDismiss: () => void;
    anchorY?: number;
}

export default function ReactionTray({
    visible,
    currentReaction,
    onSelect,
    onDismiss,
    anchorY,
}: ReactionTrayProps) {
    const ThemedColor = useThemeColor();
    const translateY = useSharedValue(12);
    const opacity = useSharedValue(0);

    useEffect(() => {
        if (visible) {
            // Plain timing — a spring here overshoots and the tray visibly bounces
            translateY.value = withTiming(0, { duration: 140 });
            opacity.value = withTiming(1, { duration: 120 });
        } else {
            translateY.value = withTiming(12, { duration: 100 });
            opacity.value = withTiming(0, { duration: 100 });
        }
    }, [visible]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
        opacity: opacity.value,
    }));

    if (!visible) return null;

    return (
        <Modal transparent animationType="none" onRequestClose={onDismiss}>
            <Pressable style={styles.backdrop} onPress={onDismiss}>
                <Pressable>
                    <Animated.View
                        style={[styles.tray, { backgroundColor: ThemedColor.card ?? ThemedColor.background }, animatedStyle]}
                    >
                        {KUDOS_REACTION_EMOJIS.map((emoji) => (
                            <Pressable
                                key={emoji}
                                onPress={() => {
                                    onSelect(emoji);
                                    onDismiss();
                                }}
                                style={[
                                    styles.emojiButton,
                                    currentReaction === emoji && {
                                        backgroundColor: "#854DFF1A",
                                        borderRadius: 20,
                                    },
                                ]}
                            >
                                <Text style={styles.emoji}>{emoji}</Text>
                            </Pressable>
                        ))}
                    </Animated.View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.3)",
    },
    tray: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 28,
        gap: 4,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },
    emojiButton: {
        width: 44,
        height: 44,
        justifyContent: "center",
        alignItems: "center",
    },
    emoji: {
        fontSize: 26,
    },
});

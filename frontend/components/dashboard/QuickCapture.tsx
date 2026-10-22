import React, { useEffect, useState } from "react";
import { View, Pressable, StyleSheet, TouchableOpacity, useColorScheme } from "react-native";
import Reanimated, { Easing, LinearTransition } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { ArrowRight, Check, Microphone, Plus } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import QuickCaptureComposer, { type Receipt } from "@/components/dashboard/QuickCaptureComposer";

// How long the confirmation sticks around. Long enough to read and catch a
// wrong date, short enough that it doesn't become furniture.
const RECEIPT_MS = 8000;
const FIELD_TRANSITION = LinearTransition.duration(200).easing(Easing.out(Easing.cubic));

/**
 * The dashboard's "Add a task" row. It's only a door: tapping it opens the
 * full-screen composer docked on the keyboard. The receipt for the last task
 * added there stays here for a moment after it closes, so a wrong guess is
 * still visible.
 */
export default function QuickCapture({
    placeholder = "Add a task",
    variant = "row",
    onSubmitted,
}: {
    placeholder?: string;
    // "pill" floats over the page (home dock): rounded, shadow instead of border
    variant?: "row" | "pill";
    /** Fires after a composer confirm creates at least one task. */
    onSubmitted?: () => void;
}) {
    const ThemedColor = useThemeColor();
    const colorScheme = useColorScheme();
    const [open, setOpen] = useState(false);
    const [voice, setVoice] = useState(false);
    const router = useRouter();
    const [receipt, setReceipt] = useState<Receipt | null>(null);

    useEffect(() => {
        if (!receipt) return;
        const timer = setTimeout(() => setReceipt(null), RECEIPT_MS);
        return () => clearTimeout(timer);
    }, [receipt]);

    const isDark = colorScheme === "dark";

    return (
        <View style={{ gap: 8 }}>
            <Pressable
                onPress={() => {
                    setVoice(false);
                    setOpen(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Add a task"
                style={[
                    styles.field,
                    {
                        // Light mode reads as an empty task row on the page
                        // rather than a gray well; dark keeps a raised surface.
                        backgroundColor: isDark ? ThemedColor.lightened : ThemedColor.background,
                        borderColor: ThemedColor.tertiary,
                    },
                    variant === "pill" && [styles.pill, { backgroundColor: isDark ? ThemedColor.lightened : ThemedColor.background }],
                ]}>
                <Plus size={18} color={ThemedColor.primary} weight="bold" />
                <ThemedText type="default" style={[styles.placeholder, { color: ThemedColor.caption }]}>
                    {placeholder}
                </ThemedText>
                <TouchableOpacity
                    onPress={() => {
                        setVoice(true);
                        setOpen(true);
                    }}
                    hitSlop={8}
                    accessibilityLabel="Add a task by voice">
                    <Microphone size={18} color={ThemedColor.caption} />
                </TouchableOpacity>
            </Pressable>

            {receipt && !open && (
                <Reanimated.View layout={FIELD_TRANSITION} style={styles.receipt} accessibilityLiveRegion="polite">
                    <Check size={14} color={ThemedColor.primary} weight="bold" />
                    <ThemedText type="caption" numberOfLines={1} style={{ flex: 1 }}>
                        Added “{receipt.content}” · {receipt.details}
                    </ThemedText>
                    {receipt.task && (
                        <TouchableOpacity
                            onPress={() => {
                                const { id, categoryId } = receipt.task!;
                                setReceipt(null);
                                router.push(
                                    `/(logged-in)/(tabs)/(task)/task/${id}?categoryId=${categoryId}&name=${encodeURIComponent(receipt.content)}`
                                );
                            }}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                            style={styles.viewLink}
                            accessibilityRole="button"
                            accessibilityLabel={`Open ${receipt.content}`}>
                            <ThemedText type="caption" style={{ color: ThemedColor.primary }}>
                                View task
                            </ThemedText>
                            <ArrowRight size={14} color={ThemedColor.primary} weight="bold" />
                        </TouchableOpacity>
                    )}
                </Reanimated.View>
            )}

            <QuickCaptureComposer
                visible={open}
                startWithVoice={voice}
                onClose={(last) => {
                    setOpen(false);
                    if (last) setReceipt(last);
                }}
                onSubmitted={onSubmitted}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    field: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        minHeight: 48,
        borderRadius: 12,
        borderWidth: 1,
        paddingLeft: 16,
        paddingRight: 16,
        paddingVertical: 8,
    },
    pill: {
        borderRadius: 100,
        borderWidth: 0,
        minHeight: 52,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 6,
    },
    placeholder: {
        flex: 1,
        fontSize: 16,
        fontFamily: "OutfitLight",
    },
    viewLink: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    receipt: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 16,
    },
});

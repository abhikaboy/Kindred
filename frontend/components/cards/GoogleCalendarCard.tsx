import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { CalendarBlank, ArrowRight, X, ArrowsClockwise } from "phosphor-react-native";
import BasicCard from "./BasicCard";

interface GoogleCalendarCardProps {
    isLinked: boolean;
    setupPending?: boolean;
    onAction: () => void;
    onDismiss?: () => void;
    loading?: boolean;
}

export const GoogleCalendarCard: React.FC<GoogleCalendarCardProps> = ({
    isLinked,
    setupPending = false,
    onAction,
    onDismiss,
    loading = false,
}) => {
    const ThemedColor = useThemeColor();

    return (
        <TouchableOpacity onPress={onAction} disabled={loading} activeOpacity={0.7}>
            <BasicCard>
                <View style={styles.container}>
                    {/* Left: Icon + Text */}
                    <View style={styles.leftSection}>
                        <CalendarBlank size={24} color={ThemedColor.primary} weight="regular" />
                        <View style={styles.textContainer}>
                            <ThemedText type="default" style={styles.title}>
                                Google Calendar
                            </ThemedText>
                            {setupPending && (
                                <ThemedText type="caption" style={styles.subtitle}>
                                    Setup required
                                </ThemedText>
                            )}
                            {isLinked && !setupPending && (
                                <ThemedText type="caption" style={styles.subtitle}>
                                    Linked
                                </ThemedText>
                            )}
                        </View>
                    </View>

                    {/* Right: Actions */}
                    <View style={styles.rightSection}>
                        <View style={styles.actionButton}>
                            <ThemedText
                                type="default"
                                style={[
                                    styles.actionText,
                                    loading && styles.loadingText
                                ]}>
                            {setupPending ? "Finish setup" : isLinked ? "Sync" : "Connect"}
                            </ThemedText>
                            {setupPending ? (
                                <ArrowRight
                                    size={14}
                                    color={loading ? ThemedColor.caption : ThemedColor.text}
                                    weight="regular"
                                />
                            ) : isLinked ? (
                                <ArrowsClockwise
                                    size={14}
                                    color={loading ? ThemedColor.caption : ThemedColor.text}
                                    weight="regular"
                                />
                            ) : (
                                <ArrowRight
                                    size={14}
                                    color={loading ? ThemedColor.caption : ThemedColor.text}
                                    weight="regular"
                                />
                            )}
                        </View>
                    </View>
                </View>
            </BasicCard>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    leftSection: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        flex: 1,
    },
    textContainer: {
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 2,
        flexShrink: 1,
    },
    title: {
        fontSize: 15,
        flexShrink: 1,
    },
    subtitle: {
        fontSize: 12,
        opacity: 0.5,
    },
    rightSection: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    dismissButton: {
        padding: 2,
    },
    actionButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    actionText: {
        fontSize: 14,
    },
    loadingText: {
        opacity: 0.5,
    },
});

import React from "react";
import { View, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, type Href } from "expo-router";
import { ArrowUp, ArrowDown, EyeSlash, Plus } from "phosphor-react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "@/components/ThemedText";
import { useAuth } from "@/hooks/useAuth";
import { WidgetId, WIDGET_TITLES } from "@/components/analytics/analyticsLayout";
import { useAnalyticsLayout } from "@/hooks/useAnalyticsLayout";

export default function EditAnalytics() {
    const ThemedColor = useThemeColor() as any;
    const styles = stylesheet(ThemedColor);
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const { order, hidden, moveWidget, toggleHidden, reset } = useAnalyticsLayout(user?._id);

    const visible = order.filter((id) => !hidden.includes(id));

    return (
        <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={reset} activeOpacity={0.7}>
                    <ThemedText type="default" style={{ color: ThemedColor.caption }}>
                        Reset
                    </ThemedText>
                </TouchableOpacity>
                <ThemedText type="fancyFrauncesSubheading">Edit Analytics</ThemedText>
                <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
                    <ThemedText type="defaultSemiBold" style={{ color: ThemedColor.primary }}>
                        Done
                    </ThemedText>
                </TouchableOpacity>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 40 }]}>
                <ThemedText type="caption" style={styles.hint}>
                    Reorder your cards or hide the ones you don't want to see.
                </ThemedText>

                <ThemedText type="defaultSemiBold" style={styles.sectionLabel}>
                    Visible
                </ThemedText>
                {visible.map((id) => (
                    <VisibleRow
                        key={id}
                        id={id}
                        index={order.indexOf(id)}
                        isFirst={order.indexOf(id) === 0}
                        isLast={order.indexOf(id) === order.length - 1}
                        onMoveUp={() => moveWidget(order.indexOf(id), order.indexOf(id) - 1)}
                        onMoveDown={() => moveWidget(order.indexOf(id), order.indexOf(id) + 1)}
                        onHide={() => toggleHidden(id)}
                    />
                ))}

                <TouchableOpacity
                    style={styles.browseButton}
                    activeOpacity={0.8}
                    onPress={() => router.push("/(activity)/add-cards" as Href)}>
                    <Plus size={18} color={ThemedColor.primary} weight="bold" />
                    <ThemedText type="defaultSemiBold" style={{ color: ThemedColor.primary }}>
                        Browse cards to add
                    </ThemedText>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}

interface VisibleRowProps {
    id: WidgetId;
    index: number;
    isFirst: boolean;
    isLast: boolean;
    onMoveUp: () => void;
    onMoveDown: () => void;
    onHide: () => void;
}

function VisibleRow({ id, isFirst, isLast, onMoveUp, onMoveDown, onHide }: VisibleRowProps) {
    const ThemedColor = useThemeColor() as any;
    const styles = stylesheet(ThemedColor);
    return (
        <View style={styles.row}>
            <ThemedText type="default" style={styles.rowTitle}>
                {WIDGET_TITLES[id]}
            </ThemedText>
            <View style={styles.actions}>
                <TouchableOpacity disabled={isFirst} onPress={onMoveUp} activeOpacity={0.7}>
                    <ArrowUp size={20} color={isFirst ? ThemedColor.tertiary : ThemedColor.text} weight="bold" />
                </TouchableOpacity>
                <TouchableOpacity disabled={isLast} onPress={onMoveDown} activeOpacity={0.7}>
                    <ArrowDown size={20} color={isLast ? ThemedColor.tertiary : ThemedColor.text} weight="bold" />
                </TouchableOpacity>
                <TouchableOpacity onPress={onHide} activeOpacity={0.7}>
                    <EyeSlash size={20} color={ThemedColor.caption} weight="bold" />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const stylesheet = (ThemedColor: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: ThemedColor.background,
        },
        header: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingHorizontal: 20,
            paddingBottom: 12,
        },
        body: {
            paddingHorizontal: 20,
        },
        hint: {
            marginBottom: 16,
            lineHeight: 18,
        },
        sectionLabel: {
            marginTop: 12,
            marginBottom: 8,
            fontSize: 13,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            color: ThemedColor.caption,
        },
        row: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: ThemedColor.lightenedCard,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: ThemedColor.tertiary,
            paddingHorizontal: 16,
            paddingVertical: 14,
            marginBottom: 10,
        },
        rowTitle: {
            fontSize: 15,
        },
        actions: {
            flexDirection: "row",
            alignItems: "center",
            gap: 18,
        },
        browseButton: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            marginTop: 16,
            paddingVertical: 14,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: ThemedColor.primary,
            borderStyle: "dashed",
        },
    });

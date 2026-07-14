import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Flag, PencilSimple } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";

// A start -> deadline "route" (pins + dotted connector), instead of two separate
// label:value rows. Meant to sit inside a DataCard.

const dayPart = (d: Date): string => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const day = new Date(d);
    day.setHours(0, 0, 0, 0);
    const diff = Math.round((day.getTime() - today.getTime()) / 86_400_000);
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    if (diff === -1) return "Yesterday";
    return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
};

const timePart = (d: Date): string => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

type Props = {
    startDate?: string;
    startTime?: string;
    deadline?: string;
    onEditDeadline?: () => void;
};

export const TaskScheduleRoute: React.FC<Props> = ({ startDate, startTime, deadline, onEditDeadline }) => {
    const ThemedColor = useThemeColor();
    const hasStart = !!startDate;
    const hasDeadline = !!deadline;

    const startLabel = hasStart
        ? startTime
            ? `${dayPart(new Date(startDate!))}, ${timePart(new Date(startTime))}`
            : dayPart(new Date(startDate!))
        : "";
    const deadlineLabel = hasDeadline ? `${dayPart(new Date(deadline!))}, ${timePart(new Date(deadline!))}` : "";

    return (
        <View style={{ paddingTop: 4 }}>
            {hasStart && (
                <View style={styles.row}>
                    <View style={styles.iconWrap}>
                        <View style={[styles.dot, { borderColor: ThemedColor.primary }]} />
                    </View>
                    <View style={styles.content}>
                        <ThemedText type="caption" style={{ color: ThemedColor.caption }}>
                            Starts
                        </ThemedText>
                        <ThemedText type="defaultSemiBold">{startLabel}</ThemedText>
                    </View>
                </View>
            )}

            {hasStart && hasDeadline && <View style={[styles.connector, { borderColor: ThemedColor.tertiary }]} />}

            {hasDeadline && (
                <View style={styles.row}>
                    <View style={styles.iconWrap}>
                        <Flag size={16} color={ThemedColor.primary} weight="fill" />
                    </View>
                    <View style={styles.content}>
                        <ThemedText type="caption" style={{ color: ThemedColor.caption }}>
                            Due
                        </ThemedText>
                        <ThemedText type="defaultSemiBold">{deadlineLabel}</ThemedText>
                    </View>
                    {onEditDeadline && (
                        <TouchableOpacity
                            onPress={onEditDeadline}
                            hitSlop={8}
                            style={[styles.edit, { backgroundColor: ThemedColor.lightened }]}>
                            <PencilSimple size={16} color={ThemedColor.text} weight="regular" />
                        </TouchableOpacity>
                    )}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", gap: 12 },
    iconWrap: { width: 20, alignItems: "center" },
    dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
    content: { flex: 1, gap: 1 },
    connector: { marginLeft: 9, height: 16, width: 0, borderLeftWidth: 1.5, borderStyle: "dashed" },
    edit: { padding: 8, borderRadius: 8 },
});

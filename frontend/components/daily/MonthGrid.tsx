import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { dayKey, DayDensity } from "@/utils/taskCountsByDay";
import { mondayOf, DayDots, DropTarget } from "./dayCells";

type Props = {
    monthAnchor: Date;
    selectedDate: Date;
    density: Record<string, DayDensity>;
    onSelectDay: (d: Date) => void;
    registerDropTarget: (key: string, target: DropTarget | null) => void;
    hoverKey: string | null;
};

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

const MonthGrid = ({ monthAnchor, selectedDate, density, onSelectDay, registerDropTarget, hoverKey }: Props) => {
    const ThemedColor = useThemeColor();
    const todayKey = dayKey(new Date());
    const selectedKey = dayKey(selectedDate);

    // Only as many rows as the month spans (4-6), so short months don't pad with next month
    const first = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), 1);
    const last = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 0);
    const gridStart = mondayOf(first);
    const rowCount = Math.ceil(((first.getDay() + 6) % 7 + last.getDate()) / 7);
    const rows = Array.from({ length: rowCount }, (_, r) =>
        Array.from({ length: 7 }, (_, c) => {
            const d = new Date(gridStart);
            d.setDate(gridStart.getDate() + r * 7 + c);
            return d;
        })
    );

    return (
        <View style={styles.wrap}>
            <View style={styles.row}>
                {WEEKDAYS.map((w, i) => (
                    <ThemedText key={i} type="caption" style={styles.weekday}>
                        {w}
                    </ThemedText>
                ))}
            </View>
            {rows.map((row, r) => (
                <View key={r} style={styles.row}>
                    {row.map((d) => {
                        const key = dayKey(d);
                        const inMonth = d.getMonth() === monthAnchor.getMonth();
                        const selected = key === selectedKey;
                        const isToday = key === todayKey;
                        const hovered = key === hoverKey;
                        return (
                            <TouchableOpacity
                                key={key}
                                onPress={() => onSelectDay(d)}
                                activeOpacity={0.7}
                                ref={(r) => registerDropTarget(key, r)}
                                style={[
                                    styles.cell,
                                    !inMonth && { opacity: 0.35 },
                                    hovered && {
                                        borderColor: ThemedColor.primary,
                                        backgroundColor: ThemedColor.lightened,
                                    },
                                ]}
                            >
                                <View
                                    style={[
                                        styles.dayNum,
                                        selected && { backgroundColor: ThemedColor.primary },
                                        isToday && !selected && { backgroundColor: ThemedColor.primary + "26" },
                                    ]}
                                >
                                    <ThemedText
                                        type="defaultSemiBold"
                                        style={[
                                            styles.dayText,
                                            isToday && { color: ThemedColor.primary },
                                            selected && { color: ThemedColor.buttonText },
                                        ]}
                                    >
                                        {d.getDate()}
                                    </ThemedText>
                                </View>
                                <DayDots density={density[key]} />
                            </TouchableOpacity>
                        );
                    })}
                </View>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    wrap: { paddingHorizontal: HORIZONTAL_PADDING, paddingBottom: 8 },
    row: { flexDirection: "row" },
    weekday: { flex: 1, textAlign: "center", paddingVertical: 4 },
    cell: {
        flex: 1,
        alignItems: "center",
        gap: 2,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: "transparent",
        borderStyle: "dashed",
    },
    dayNum: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
    },
    dayText: { fontSize: 15 },
});

export default MonthGrid;

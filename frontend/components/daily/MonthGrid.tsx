import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { dayKey, DayDensity } from "@/utils/taskCountsByDay";
import { DayDots, mondayOf, DropRectValue } from "./WeekStrip";

type Props = {
    monthAnchor: Date;
    density: Record<string, DayDensity>;
    onSelectDay: (d: Date) => void;
    registerDropRect: (key: string, rect: DropRectValue | null) => void;
    hoverKey: string | null;
};

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

const MonthGrid = ({ monthAnchor, density, onSelectDay, registerDropRect, hoverKey }: Props) => {
    const ThemedColor = useThemeColor();
    const todayKey = dayKey(new Date());
    const first = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), 1);
    const gridStart = mondayOf(first);
    const cells = Array.from({ length: 42 }, (_, i) => {
        const d = new Date(gridStart);
        d.setDate(gridStart.getDate() + i);
        return d;
    });

    return (
        <View style={styles.wrap}>
            <View style={styles.weekdayRow}>
                {WEEKDAYS.map((w, i) => (
                    <ThemedText key={i} type="caption" style={styles.weekday}>
                        {w}
                    </ThemedText>
                ))}
            </View>
            <View style={styles.grid}>
                {cells.map((d) => {
                    const key = dayKey(d);
                    const inMonth = d.getMonth() === monthAnchor.getMonth();
                    const isToday = key === todayKey;
                    const hovered = key === hoverKey;
                    const day = density[key];
                    return (
                        <TouchableOpacity
                            key={key}
                            onPress={() => onSelectDay(d)}
                            onLayout={(e) => {
                                e.currentTarget.measureInWindow((x, y, width, height) =>
                                    registerDropRect(key, { x, y, width, height })
                                );
                            }}
                            style={[
                                styles.cell,
                                { borderColor: ThemedColor.tertiary },
                                !inMonth && { opacity: 0.35 },
                                isToday && { borderColor: ThemedColor.primary, borderWidth: 1.5 },
                                hovered && {
                                    borderColor: ThemedColor.primary,
                                    borderStyle: "dashed",
                                    backgroundColor: ThemedColor.lightened,
                                },
                            ]}
                        >
                            <ThemedText type="caption">{d.getDate()}</ThemedText>
                            <DayDots density={day} />
                            {day && day.count > 3 && (
                                <ThemedText type="caption" style={{ fontSize: 9, color: ThemedColor.caption }}>
                                    +{day.count - 3}
                                </ThemedText>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    wrap: { paddingHorizontal: HORIZONTAL_PADDING },
    weekdayRow: { flexDirection: "row" },
    weekday: { flex: 1, textAlign: "center", paddingVertical: 4 },
    grid: { flexDirection: "row", flexWrap: "wrap" },
    cell: {
        width: `${100 / 7}%`,
        minHeight: 56,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 8,
        padding: 4,
        alignItems: "flex-start",
        gap: 2,
    },
});

export default MonthGrid;

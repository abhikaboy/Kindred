import React, { useMemo } from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useTasks } from "@/contexts/tasksContext";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { dayKey, DayDensity } from "@/utils/taskCountsByDay";
import { mondayOf, DropRectValue } from "./WeekStrip";

type Props = {
    monthAnchor: Date;
    density: Record<string, DayDensity>;
    onSelectDay: (d: Date) => void;
    registerDropRect: (key: string, rect: DropRectValue | null) => void;
    hoverKey: string | null;
};

type DayChip = { content: string; color: string };

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const MAX_CHIPS = 3;

const MonthGrid = ({ monthAnchor, onSelectDay, registerDropRect, hoverKey }: Props) => {
    const ThemedColor = useThemeColor();
    const { workspaces, unnestedTasks } = useTasks();
    const todayKey = dayKey(new Date());

    const first = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), 1);
    const gridStart = mondayOf(first);
    const cells = Array.from({ length: 42 }, (_, i) => {
        const d = new Date(gridStart);
        d.setDate(gridStart.getDate() + i);
        return d;
    });
    const rows = Array.from({ length: 6 }, (_, r) => cells.slice(r * 7, r * 7 + 7));

    // Task chips per day (dot color = workspace color), bucketed by start/deadline.
    const tasksByDay = useMemo(() => {
        const colorByWs = new Map<string, string>();
        for (const ws of workspaces) if (ws.color) colorByWs.set(ws.name, ws.color);
        const map: Record<string, DayChip[]> = {};
        for (const t of unnestedTasks) {
            const keys = new Set<string>();
            for (const field of ["startDate", "deadline"] as const) {
                if (t[field]) keys.add(dayKey(new Date(t[field] as string)));
            }
            const chip: DayChip = {
                content: t.content,
                color: colorByWs.get(t.workspaceName ?? "") ?? ThemedColor.primary,
            };
            for (const k of keys) (map[k] ??= []).push(chip);
        }
        return map;
    }, [unnestedTasks, workspaces, ThemedColor.primary]);

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
                {rows.map((row, r) => (
                    <View key={r} style={styles.row}>
                        {row.map((d) => {
                            const key = dayKey(d);
                            const inMonth = d.getMonth() === monthAnchor.getMonth();
                            const isToday = key === todayKey;
                            const hovered = key === hoverKey;
                            const chips = tasksByDay[key] ?? [];
                            return (
                                <TouchableOpacity
                                    key={key}
                                    onPress={() => onSelectDay(d)}
                                    activeOpacity={0.7}
                                    onLayout={(e) => {
                                        e.currentTarget.measureInWindow((x, y, width, height) =>
                                            registerDropRect(key, { x, y, width, height })
                                        );
                                    }}
                                    style={[
                                        styles.cell,
                                        { borderColor: ThemedColor.tertiary },
                                        !inMonth && { opacity: 0.4 },
                                        hovered && {
                                            borderColor: ThemedColor.primary,
                                            borderStyle: "dashed",
                                            backgroundColor: ThemedColor.lightened,
                                        },
                                    ]}
                                >
                                    <View
                                        style={[
                                            styles.dayNum,
                                            isToday && { backgroundColor: ThemedColor.primary },
                                        ]}
                                    >
                                        <ThemedText
                                            type="caption"
                                            style={{ color: isToday ? ThemedColor.buttonText : ThemedColor.text }}
                                        >
                                            {d.getDate()}
                                        </ThemedText>
                                    </View>

                                    {chips.slice(0, MAX_CHIPS).map((c, i) => (
                                        <View key={i} style={styles.chip}>
                                            <View style={[styles.dot, { backgroundColor: c.color }]} />
                                            <ThemedText style={[styles.chipText, { color: ThemedColor.caption }]} numberOfLines={1}>
                                                {c.content}
                                            </ThemedText>
                                        </View>
                                    ))}
                                    {chips.length > MAX_CHIPS && (
                                        <ThemedText style={[styles.more, { color: ThemedColor.caption }]}>
                                            +{chips.length - MAX_CHIPS}
                                        </ThemedText>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    wrap: { flex: 1, paddingHorizontal: HORIZONTAL_PADDING, paddingBottom: 8 },
    weekdayRow: { flexDirection: "row" },
    weekday: { flex: 1, textAlign: "center", paddingVertical: 4 },
    grid: { flex: 1 },
    row: { flexDirection: "row", flex: 1 },
    cell: {
        flex: 1,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 8,
        padding: 3,
        gap: 2,
        overflow: "hidden",
    },
    dayNum: {
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        paddingHorizontal: 5,
        alignItems: "center",
        justifyContent: "center",
        alignSelf: "flex-start",
    },
    chip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
    },
    dot: { width: 5, height: 5, borderRadius: 2.5, flexShrink: 0 },
    chipText: { fontSize: 9, lineHeight: 12, flexShrink: 1 },
    more: { fontSize: 9, lineHeight: 12 },
});

export default MonthGrid;

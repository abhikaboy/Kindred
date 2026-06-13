import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "@/components/ThemedText";
import { AnalyticsHeatmapDay } from "@/api/analytics";
import { heatmapLevelColor } from "../analyticsColors";

interface MonthHeatmapProps {
    days: AnalyticsHeatmapDay[];
    onSelectDay?: (date: Date) => void;
    weeks?: number;
}

const WEEKDAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const CELL = 16;
const GAP = 4;

function parseLocalDate(iso: string): Date {
    const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
    return new Date(y, (m || 1) - 1, d || 1);
}

// Mon=0 ... Sun=6
function mondayIndex(date: Date): number {
    return (date.getDay() + 6) % 7;
}

/** Monday-aligned calendar grid (weekday columns, week rows). Cells with
 * activity are tappable to inspect that day. */
export function MonthHeatmap({ days, onSelectDay, weeks = 10 }: MonthHeatmapProps) {
    const ThemedColor = useThemeColor() as any;
    const styles = stylesheet(ThemedColor);
    const safeDays = days ?? [];

    if (safeDays.length === 0) {
        return null;
    }

    const firstMon = mondayIndex(parseLocalDate(safeDays[0].date));
    const cells: (AnalyticsHeatmapDay | null)[] = [];
    for (let i = 0; i < firstMon; i++) cells.push(null);
    safeDays.forEach((d) => cells.push(d));

    const rows: (AnalyticsHeatmapDay | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    const shown = rows.slice(-weeks);

    return (
        <View>
            <View style={styles.headerRow}>
                {WEEKDAY_LABELS.map((label, i) => (
                    <ThemedText key={i} type="caption" style={styles.headerLabel}>
                        {label}
                    </ThemedText>
                ))}
            </View>
            {shown.map((week, wi) => (
                <View key={wi} style={styles.weekRow}>
                    {Array.from({ length: 7 }).map((_, di) => (
                        <HeatCell key={di} day={week[di] ?? null} onSelectDay={onSelectDay} ThemedColor={ThemedColor} />
                    ))}
                </View>
            ))}
        </View>
    );
}

function HeatCell({
    day,
    onSelectDay,
    ThemedColor,
}: {
    day: AnalyticsHeatmapDay | null;
    onSelectDay?: (date: Date) => void;
    ThemedColor: any;
}) {
    if (!day) {
        return <View style={{ width: CELL, height: CELL }} />;
    }
    const empty = day.level === 0;
    const tappable = day.count > 0 && !!onSelectDay;
    return (
        <TouchableOpacity
            disabled={!tappable}
            activeOpacity={0.6}
            onPress={() => onSelectDay?.(parseLocalDate(day.date))}>
            <View
                style={{
                    width: CELL,
                    height: CELL,
                    borderRadius: 4,
                    backgroundColor: heatmapLevelColor(day.level, ThemedColor),
                    borderWidth: empty ? StyleSheet.hairlineWidth : 0,
                    borderColor: ThemedColor.tertiary,
                }}
            />
        </TouchableOpacity>
    );
}

const stylesheet = (ThemedColor: any) =>
    StyleSheet.create({
        headerRow: {
            flexDirection: "row",
            gap: GAP,
            marginBottom: GAP,
        },
        headerLabel: {
            width: CELL,
            textAlign: "center",
            fontSize: 10,
        },
        weekRow: {
            flexDirection: "row",
            gap: GAP,
            marginBottom: GAP,
        },
    });

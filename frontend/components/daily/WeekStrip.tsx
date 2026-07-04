import React from "react";
import { View, TouchableOpacity, StyleSheet, useColorScheme } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { dayKey, DayDensity } from "@/utils/taskCountsByDay";
import { getCategoryDuotoneColors } from "@/utils/categoryColors";

export const mondayOf = (d: Date): Date => {
    const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dow = (out.getDay() + 6) % 7; // Mon=0
    out.setDate(out.getDate() - dow);
    return out;
};

export const DayDots = ({ density }: { density?: DayDensity }) => {
    const scheme = useColorScheme() ?? "light";
    if (!density) return <View style={dotStyles.row} />;
    return (
        <View style={dotStyles.row}>
            {density.categoryRefs.map((ref, i) => (
                <View
                    key={i}
                    style={[
                        dotStyles.dot,
                        { backgroundColor: getCategoryDuotoneColors(ref.categoryID, ref.categoryName, scheme).dark },
                    ]}
                />
            ))}
        </View>
    );
};

const dotStyles = StyleSheet.create({
    row: { flexDirection: "row", gap: 3, minHeight: 6, justifyContent: "center" },
    dot: { width: 5, height: 5, borderRadius: 3 },
});

export type DropRectValue = { x: number; y: number; width: number; height: number };

type Props = {
    weekStart: Date;
    selectedDate: Date;
    onSelectDate: (d: Date) => void;
    density: Record<string, DayDensity>;
    registerDropRect: (key: string, rect: DropRectValue | null) => void;
    hoverKey: string | null;
};

const WeekStrip = ({ weekStart, selectedDate, onSelectDate, density, registerDropRect, hoverKey }: Props) => {
    const ThemedColor = useThemeColor();
    const todayKey = dayKey(new Date());
    const selectedKey = dayKey(selectedDate);
    const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return d;
    });

    return (
        <View style={styles.row}>
            {days.map((d) => {
                const key = dayKey(d);
                const selected = key === selectedKey;
                const isToday = key === todayKey;
                const hovered = key === hoverKey;
                return (
                    <TouchableOpacity
                        key={key}
                        onPress={() => onSelectDate(d)}
                        onLayout={(e) => {
                            e.currentTarget.measureInWindow((x, y, width, height) =>
                                registerDropRect(key, { x, y, width, height })
                            );
                        }}
                        style={[
                            styles.day,
                            selected && { backgroundColor: ThemedColor.primary },
                            hovered && {
                                borderWidth: 1.5,
                                borderColor: ThemedColor.primary,
                                borderStyle: "dashed",
                                backgroundColor: ThemedColor.lightened,
                            },
                        ]}
                    >
                        <ThemedText type="caption" style={selected ? { color: ThemedColor.buttonText } : undefined}>
                            {d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}
                        </ThemedText>
                        <ThemedText
                            type="defaultSemiBold"
                            style={[
                                isToday && !selected ? { color: ThemedColor.primary } : undefined,
                                selected ? { color: ThemedColor.buttonText } : undefined,
                            ]}
                        >
                            {d.getDate()}
                        </ThemedText>
                        <DayDots density={density[key]} />
                    </TouchableOpacity>
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    row: {
        flexDirection: "row",
        justifyContent: "space-between",
        paddingHorizontal: HORIZONTAL_PADDING,
        paddingVertical: 6,
    },
    day: {
        alignItems: "center",
        gap: 2,
        paddingVertical: 8,
        paddingHorizontal: 4,
        borderRadius: 12,
        minWidth: 42,
    },
});

export default WeekStrip;

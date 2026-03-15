import React from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import ActivityPoint from "@/components/profile/ActivityPoint";
import { HORIZONTAL_PADDING } from "@/constants/spacing";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

const GRID_GAP = 4;
const GRID_PADDING = HORIZONTAL_PADDING;
const CELL_SIZE = Math.floor(
    (Dimensions.get("window").width - GRID_PADDING * 2 - GRID_GAP * 6) / 7
);

export { CELL_SIZE, GRID_GAP };

interface CalendarMonthProps {
    monthName: string;
    year: number;
    monthNumber: number;
    levels: number[];
    onDayPress: (dayNumber: number) => void;
    ThemedColor: any;
}

const CalendarMonth: React.FC<CalendarMonthProps> = React.memo(({
    monthName,
    year,
    monthNumber,
    levels,
    onDayPress,
    ThemedColor,
}) => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();

    const firstDayOffset = new Date(year, monthNumber - 1, 1).getDay();
    const daysInMonth = levels.length;
    const totalCells = firstDayOffset + daysInMonth;
    const rows = Math.ceil(totalCells / 7);

    return (
        <View style={styles.monthBlock}>
            <ThemedText type="defaultSemiBold" style={{ fontSize: 15 }}>
                {monthName}
            </ThemedText>

            <View style={styles.weekRow}>
                {WEEKDAY_LABELS.map((label, i) => (
                    <View key={i} style={styles.cell}>
                        <ThemedText type="caption" style={{ fontSize: 10, color: ThemedColor.caption, textAlign: "center" }}>
                            {label}
                        </ThemedText>
                    </View>
                ))}
            </View>

            {Array.from({ length: rows }).map((_, rowIdx) => (
                <View key={rowIdx} style={styles.weekRow}>
                    {Array.from({ length: 7 }).map((_, colIdx) => {
                        const cellIndex = rowIdx * 7 + colIdx;
                        const dayNumber = cellIndex - firstDayOffset + 1;

                        if (cellIndex < firstDayOffset || dayNumber > daysInMonth) {
                            return <View key={colIdx} style={styles.cell} />;
                        }

                        const level = levels[dayNumber - 1];

                        const isFuture =
                            year > currentYear ||
                            (year === currentYear && monthNumber > currentMonth) ||
                            (year === currentYear && monthNumber === currentMonth && dayNumber > currentDay);

                        const isToday =
                            year === currentYear &&
                            monthNumber === currentMonth &&
                            dayNumber === currentDay;

                        return (
                            <View key={colIdx} style={styles.cell}>
                                <ActivityPoint
                                    level={level}
                                    isFuture={isFuture}
                                    isToday={isToday}
                                    size={CELL_SIZE - 6}
                                    onPress={() => {
                                        if (!isFuture && level > 0) {
                                            onDayPress(dayNumber);
                                        }
                                    }}
                                />
                            </View>
                        );
                    })}
                </View>
            ))}
        </View>
    );
});

export default CalendarMonth;

const styles = StyleSheet.create({
    monthBlock: {
        marginTop: 20,
        gap: 4,
        width: "100%",
    },
    weekRow: {
        flexDirection: "row",
        gap: GRID_GAP,
    },
    cell: {
        width: CELL_SIZE,
        height: CELL_SIZE,
        alignItems: "center",
        justifyContent: "center",
    },
});

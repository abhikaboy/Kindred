import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { CaretLeft, CaretRight } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";

interface DateNavBarProps {
    selectedDate: Date;
    onDateChange: (date: Date) => void;
    onPressLabel: () => void;
    onBack?: () => void;
}

const getLabel = (date: Date): string => {
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const selected = startOfDay(date);
    const today = startOfDay(new Date());
    const oneDay = 24 * 60 * 60 * 1000;

    if (selected === today) return "Today";
    if (selected === today + oneDay) return "Tomorrow";
    if (selected === today - oneDay) return "Yesterday";

    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
};

// Slim header bar: back button on the left, a screen-centered date stepper
// (chevrons step a day; tapping the label opens the floating calendar picker).
export const DateNavBar: React.FC<DateNavBarProps> = ({ selectedDate, onDateChange, onPressLabel, onBack }) => {
    const ThemedColor = useThemeColor();

    const shiftDay = (delta: number) => {
        const d = new Date(selectedDate);
        d.setDate(selectedDate.getDate() + delta);
        onDateChange(d);
    };

    return (
        <View style={[styles.bar, { borderBottomColor: ThemedColor.tertiary }]}>
            <View style={styles.side}>
                {onBack && (
                    <TouchableOpacity
                        onPress={onBack}
                        style={[styles.backButton, { backgroundColor: ThemedColor.lightened }]}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityRole="button"
                        accessibilityLabel="Go back">
                        <CaretLeft size={20} color={ThemedColor.text} weight="bold" />
                    </TouchableOpacity>
                )}
            </View>

            <View style={styles.stepper}>
                <TouchableOpacity
                    onPress={() => shiftDay(-1)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    accessibilityRole="button"
                    accessibilityLabel="Previous day">
                    <CaretLeft size={20} color={ThemedColor.text} weight="bold" />
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={onPressLabel}
                    style={styles.label}
                    accessibilityRole="button"
                    accessibilityLabel="Pick a date">
                    <ThemedText type="defaultSemiBold">{getLabel(selectedDate)}</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => shiftDay(1)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    accessibilityRole="button"
                    accessibilityLabel="Next day">
                    <CaretRight size={20} color={ThemedColor.text} weight="bold" />
                </TouchableOpacity>
            </View>

            <View style={styles.side} />
        </View>
    );
};

const styles = StyleSheet.create({
    bar: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: HORIZONTAL_PADDING,
        paddingTop: 8,
        paddingBottom: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    // Equal-width gutters keep the stepper centered on screen.
    side: {
        width: 36,
        justifyContent: "center",
    },
    backButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
    },
    stepper: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
    },
    label: {
        minWidth: 120,
        alignItems: "center",
    },
});

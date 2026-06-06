import React, { useEffect, useState } from "react";
import { View, TouchableOpacity, StyleSheet, Pressable } from "react-native";
import { CaretLeft, CaretRight, XCircle } from "phosphor-react-native";
import Animated, {
    useAnimatedStyle,
    withTiming,
    useSharedValue,
    interpolate,
    Easing,
    runOnJS,
} from "react-native-reanimated";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { MonthView } from "@/components/ui/MonthView";
import { addMonths, subMonths } from "date-fns";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface CalendarPickerOverlayProps {
    visible: boolean;
    selectedDate: Date;
    onDateChange: (date: Date) => void;
    onClose: () => void;
    // Distance from the top of the screen to drop the floating card.
    topOffset: number;
}

// Floating month picker anchored under the date bar. Fades in over a faint
// scrim; tapping a day, the scrim, or Close dismisses it.
export const CalendarPickerOverlay: React.FC<CalendarPickerOverlayProps> = ({
    visible,
    selectedDate,
    onDateChange,
    onClose,
    topOffset,
}) => {
    const ThemedColor = useThemeColor();
    const [mounted, setMounted] = useState(visible);
    const [calendarDate, setCalendarDate] = useState(selectedDate);
    const progress = useSharedValue(0);

    useEffect(() => {
        if (visible) {
            setCalendarDate(selectedDate);
            setMounted(true);
            progress.value = withTiming(1, { duration: 250, easing: Easing.out(Easing.cubic) });
        } else if (mounted) {
            progress.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) }, (finished) => {
                if (finished) runOnJS(setMounted)(false);
            });
        }
    }, [visible, selectedDate]);

    const handleMonthChange = (direction: "prev" | "next") => {
        setCalendarDate((d) => (direction === "next" ? addMonths(d, 1) : subMonths(d, 1)));
    };

    const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
    const cardStyle = useAnimatedStyle(() => ({
        opacity: progress.value,
        transform: [{ translateY: interpolate(progress.value, [0, 1], [-8, 0]) }],
    }));

    if (!mounted) return null;

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            <AnimatedPressable
                style={[StyleSheet.absoluteFill, scrimStyle, { backgroundColor: "rgba(0,0,0,0.18)" }]}
                onPress={onClose}
            />

            <Animated.View
                style={[
                    styles.card,
                    cardStyle,
                    { top: topOffset, backgroundColor: ThemedColor.lightened, borderColor: ThemedColor.tertiary },
                ]}>
                <View style={styles.calendarHeader}>
                    <TouchableOpacity
                        onPress={() => handleMonthChange("prev")}
                        style={styles.monthButton}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <CaretLeft size={24} color={ThemedColor.text} weight="bold" />
                    </TouchableOpacity>

                    <ThemedText type="subtitle" style={styles.monthTitle}>
                        {calendarDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                    </ThemedText>

                    <TouchableOpacity
                        onPress={() => handleMonthChange("next")}
                        style={styles.monthButton}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <CaretRight size={24} color={ThemedColor.text} weight="bold" />
                    </TouchableOpacity>
                </View>

                <MonthView centerDate={calendarDate} selectedDate={selectedDate} onDateSelected={onDateChange} />

                <TouchableOpacity
                    style={[styles.closeButton, { borderTopColor: ThemedColor.tertiary }]}
                    onPress={onClose}>
                    <XCircle size={22} color={ThemedColor.caption} weight="regular" />
                    <ThemedText type="default" style={{ color: ThemedColor.caption, marginLeft: 8 }}>
                        Close
                    </ThemedText>
                </TouchableOpacity>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        position: "absolute",
        left: 16,
        right: 16,
        borderRadius: 16,
        borderWidth: 1,
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 12,
    },
    calendarHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
    },
    monthTitle: {
        fontSize: 18,
        flex: 1,
        textAlign: "center",
    },
    monthButton: {
        padding: 4,
        width: 40,
        alignItems: "center",
    },
    closeButton: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        paddingVertical: 14,
        marginTop: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
});

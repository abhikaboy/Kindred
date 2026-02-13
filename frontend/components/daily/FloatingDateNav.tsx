import React, { useState } from "react";
import { View, TouchableOpacity, StyleSheet, useColorScheme } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
    useAnimatedStyle,
    withTiming,
    useSharedValue,
    interpolate,
    Extrapolate,
    Easing
} from "react-native-reanimated";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { MonthView } from "@/components/ui/MonthView";
import { addMonths, subMonths } from "date-fns";

interface FloatingDateNavProps {
    selectedDate: Date;
    onDateChange: (date: Date) => void;
}

export const FloatingDateNav: React.FC<FloatingDateNavProps> = ({
    selectedDate,
    onDateChange,
}) => {
    const ThemedColor = useThemeColor();
    const colorScheme = useColorScheme();
    const [isExpanded, setIsExpanded] = useState(false);
    const [calendarDate, setCalendarDate] = useState(selectedDate);
    const expandProgress = useSharedValue(0);

    const handlePrevDay = () => {
        const prevDate = new Date(selectedDate);
        prevDate.setDate(selectedDate.getDate() - 1);
        onDateChange(prevDate);
    };

    const handleNextDay = () => {
        const nextDate = new Date(selectedDate);
        nextDate.setDate(selectedDate.getDate() + 1);
        onDateChange(nextDate);
    };

    const handleDatePress = () => {
        setCalendarDate(selectedDate);
        setIsExpanded(true);
        expandProgress.value = withTiming(1, {
            duration: 300,
            easing: Easing.out(Easing.cubic),
        });
    };

    const handleMonthChange = (direction: "prev" | "next") => {
        if (direction === "next") {
            setCalendarDate(addMonths(calendarDate, 1));
        } else {
            setCalendarDate(subMonths(calendarDate, 1));
        }
    };

    const handleDateSelect = (date: Date) => {
        onDateChange(date);
        expandProgress.value = withTiming(0, {
            duration: 300,
            easing: Easing.out(Easing.cubic),
        });
        setTimeout(() => setIsExpanded(false), 300);
    };

    const handleClose = () => {
        expandProgress.value = withTiming(0, {
            duration: 300,
            easing: Easing.out(Easing.cubic),
        });
        setTimeout(() => setIsExpanded(false), 300);
    };

    // Get lighter/elevated background color
    const getBackgroundColor = () => {
        const baseColor = ThemedColor.lightened;
        return baseColor;
    };

    const animatedContainerStyle = useAnimatedStyle(() => {
        const height = interpolate(
            expandProgress.value,
            [0, 1],
            [48, 480], // From compact to half screen
            Extrapolate.CLAMP
        );

        const borderRadius = interpolate(
            expandProgress.value,
            [0, 1],
            [24, 16],
            Extrapolate.CLAMP
        );

        // Animate width only when expanded
        const shouldSetWidth = expandProgress.value > 0.01;
        const width = shouldSetWidth ? interpolate(
            expandProgress.value,
            [0, 1],
            [160, 360],
            Extrapolate.CLAMP
        ) : undefined;

        return {
            width,
            height,
            borderRadius,
        };
    });

    const calendarOpacity = useAnimatedStyle(() => ({
        opacity: expandProgress.value,
    }));

    const compactControlsOpacity = useAnimatedStyle(() => ({
        opacity: 1 - expandProgress.value,
    }));

    return (
        <Animated.View
            style={[
                styles.floatingNav,
                animatedContainerStyle,
                {
                    backgroundColor: getBackgroundColor(),
                    borderColor: ThemedColor.border,
                },
            ]}
        >
            {/* Compact Controls - Visible when collapsed */}
            {!isExpanded && (
                <Animated.View style={[styles.compactControls, compactControlsOpacity]}>
                    <TouchableOpacity
                        onPress={handlePrevDay}
                        style={styles.navButton}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons name="chevron-back" size={24} color={ThemedColor.text} />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleDatePress} style={styles.dateButton}>
                        <ThemedText type="default" style={styles.navDateText}>
                            {selectedDate.toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                            })}
                        </ThemedText>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={handleNextDay}
                        style={styles.navButton}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons name="chevron-forward" size={24} color={ThemedColor.text} />
                    </TouchableOpacity>
                </Animated.View>
            )}

            {/* Expanded Calendar - Visible when expanded */}
            {isExpanded && (
                <Animated.View style={[styles.expandedContent, calendarOpacity]}>
                    {/* Calendar Header */}
                    <View style={styles.calendarHeader}>
                        <TouchableOpacity
                            onPress={() => handleMonthChange("prev")}
                            style={styles.monthButton}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Ionicons name="chevron-back" size={28} color={ThemedColor.text} />
                        </TouchableOpacity>

                        <View style={styles.monthTitleContainer}>
                            <ThemedText type="subtitle" style={styles.monthTitle}>
                                {calendarDate.toLocaleDateString("en-US", {
                                    month: "long",
                                    year: "numeric",
                                })}
                            </ThemedText>
                        </View>

                        <TouchableOpacity
                            onPress={() => handleMonthChange("next")}
                            style={styles.monthButton}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Ionicons name="chevron-forward" size={28} color={ThemedColor.text} />
                        </TouchableOpacity>
                    </View>

                    {/* Month View */}
                    <View style={styles.calendarWrapper}>
                        <MonthView
                            centerDate={calendarDate}
                            selectedDate={selectedDate}
                            onDateSelected={handleDateSelect}
                        />
                    </View>

                    {/* Close Button */}
                    <TouchableOpacity
                        style={[styles.closeButton, { borderTopColor: ThemedColor.border }]}
                        onPress={handleClose}
                    >
                        <Ionicons name="close-circle-outline" size={24} color={ThemedColor.caption} />
                        <ThemedText type="default" style={{ color: ThemedColor.caption, marginLeft: 8 }}>
                            Close
                        </ThemedText>
                    </TouchableOpacity>
                </Animated.View>
            )}
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    floatingNav: {
        position: "absolute",
        bottom: 100,
        right: 16,
        borderWidth: 1,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.10,
        shadowRadius: 8,
        elevation: 8,
        zIndex: 1000,
        overflow: "hidden",
        alignSelf: "flex-end",
        boxShadow: "0px 2px 2px 0px rgba(0, 0, 0, 0.05)",
    },
    compactControls: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        paddingVertical: 8,
        height: "100%",
    },
    navButton: {
        padding: 4,
    },
    dateButton: {
        paddingHorizontal: 8,
    },
    navDateText: {
        fontSize: 15,
        fontWeight: "600",
    },
    expandedContent: {
        flex: 1,
        paddingTop: 16,
        paddingBottom: 8,
    },
    calendarHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
    },
    monthTitleContainer: {
        flex: 1,
        alignItems: "center",
    },
    monthTitle: {
        fontSize: 18,
    },
    monthButton: {
        padding: 4,
        width: 40,
        alignItems: "center",
    },
    calendarWrapper: {
        flex: 1,
    },
    closeButton: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        paddingVertical: 14,
        marginTop: 12,
        borderTopWidth: 1,
    },
});

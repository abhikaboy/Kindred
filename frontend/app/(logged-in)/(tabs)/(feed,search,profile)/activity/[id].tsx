import { Dimensions, StyleSheet, Text, View, ScrollView, TouchableOpacity, Animated } from "react-native";
import React, { useState, useEffect, useRef } from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import ActivityPoint from "@/components/profile/ActivityPoint";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { activityAPI, getMonthlyActivityLevels, ActivityDocument, calculateActivityLevel } from "@/api/activity";
import CompletedTasksBottomSheetModal from "@/components/modals/CompletedTasksBottomSheetModal";
import RecurringTasksSelectionModal from "@/components/modals/RecurringTasksSelectionModal";
import { getUserTemplatesAPI } from "@/api/task";
import PrimaryButton from "@/components/inputs/PrimaryButton";

type Props = {};

const month_to_days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const month_names = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];

// Skeleton Loader Component
const ActivitySkeleton = ({ ThemedColor }: { ThemedColor: any }) => {
    const shimmerAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(shimmerAnim, {
                    toValue: 1,
                    duration: 1500,
                    useNativeDriver: true,
                }),
                Animated.timing(shimmerAnim, {
                    toValue: 0,
                    duration: 1500,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, [shimmerAnim]);

    const opacity = shimmerAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.7],
    });

    const renderMonthSkeleton = (key: number) => {
        const numPoints = 30;
        const pointRows = Math.ceil(numPoints / 7);

        return (
            <View key={key} style={skeletonStyles.monthContainer}>
                <Animated.View
                    style={[
                        skeletonStyles.monthNameSkeleton,
                        {
                            backgroundColor: ThemedColor.tertiary,
                            opacity,
                        },
                    ]}
                />

                <View style={skeletonStyles.activityGridContainer}>
                    {Array.from({ length: pointRows }).map((_, rowIndex) => (
                        <View key={rowIndex} style={skeletonStyles.activityRow}>
                            {Array.from({ length: 7 }).map((_, pointIndex) => {
                                if (rowIndex * 7 + pointIndex >= numPoints) return null;

                                return (
                                    <Animated.View
                                        key={pointIndex}
                                        style={[
                                            skeletonStyles.activityPointSkeleton,
                                            {
                                                backgroundColor: ThemedColor.tertiary,
                                                opacity: Animated.add(opacity, new Animated.Value(Math.random() * 0.2)),
                                            },
                                        ]}
                                    />
                                );
                            })}
                        </View>
                    ))}
                </View>
            </View>
        );
    };

    return <View style={skeletonStyles.container}>{[0, 1, 2].map((index) => renderMonthSkeleton(index))}</View>;
};

const Activity = (props: Props) => {
    const ThemedColor = useThemeColor();
    const [year, setYear] = useState(new Date().getFullYear());
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [activities, setActivities] = useState<ActivityDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [templates, setTemplates] = useState<any[]>([]);
    const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
    const [breakdownModalVisible, setBreakdownModalVisible] = useState(false);
    const [breakdownMode, setBreakdownMode] = useState(false);
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const userId = params.id as string;
    const displayName = params.displayName as string;
    const styles = stylesheet(ThemedColor, insets);

    useEffect(() => {
        const fetchActivityData = async () => {
            if (!userId) {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError(null);

                const yearActivities = await activityAPI.getAllUserActivity(userId, year);
                setActivities(yearActivities);

                // Fetch templates for breakdown feature
                try {
                    const userTemplates = await getUserTemplatesAPI();
                    console.log("Fetched templates:", userTemplates);
                    setTemplates(userTemplates);
                } catch (templateErr) {
                    console.error("Failed to fetch templates:", templateErr);
                    // Don't fail the whole page if templates fail
                    setTemplates([]);
                }
            } catch (err) {
                console.error("Failed to fetch activity data:", err);
                setError("Failed to load activity data");
            } finally {
                setLoading(false);
            }
        };

        fetchActivityData();
    }, [userId, year]);

    const setYearWithinBounds = (year: number) => {
        if (year < 2024) {
            setYear(2024);
        } else if (year > new Date().getFullYear()) {
            setYear(new Date().getFullYear());
        } else {
            setYear(year);
        }
    };

    const getBreakdownActivityLevels = (month: number): number[] => {
        const daysInMonth = new Date(year, month, 0).getDate();
        const monthlyLevels: number[] = new Array(daysInMonth).fill(0);

        selectedTemplateIds.forEach((templateId) => {
            const template = templates.find((t) => t.id === templateId);
            if (!template?.completionDates) return;

            template.completionDates.forEach((dateStr: string) => {
                const date = new Date(dateStr);
                if (date.getFullYear() === year && date.getMonth() + 1 === month) {
                    const day = date.getDate();
                    if (day >= 1 && day <= daysInMonth) {
                        monthlyLevels[day - 1]++;
                    }
                }
            });
        });

        // Convert counts to activity levels (0-4)
        return monthlyLevels.map((count) => calculateActivityLevel(count));
    };

    return (
        <ThemedView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ThemedText type="default" style={styles.backArrow}>
                        ←
                    </ThemedText>
                </TouchableOpacity>
                <ThemedText type="fancyFrauncesHeading" style={styles.title}>
                    {displayName ? `${displayName}'s Activity` : "Activity"}
                </ThemedText>
            </View>

            {/* Content */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}>
                <View style={styles.yearSelector}>
                    <TouchableOpacity onPress={() => setYearWithinBounds(year - 1)}>
                        <Ionicons name="chevron-back" size={24} color={ThemedColor.text} />
                    </TouchableOpacity>
                    <View style={styles.yearContainer}>
                        <Ionicons name="calendar" size={24} color={ThemedColor.text} />
                        <ThemedText type="lightBody">{year}</ThemedText>
                    </View>
                    <TouchableOpacity onPress={() => setYearWithinBounds(year + 1)}>
                        <Ionicons name="chevron-forward" size={24} color={ThemedColor.text} />
                    </TouchableOpacity>
                </View>

                {!breakdownMode && (
                    <View style={styles.breakdownButtonContainer}>
                        <PrimaryButton
                            title={templates.length === 0 ? "No recurring tasks yet" : "Break down by recurring tasks"}
                            outline
                            onPress={() => setBreakdownModalVisible(true)}
                            style={styles.breakdownButton}
                            disabled={templates.length === 0}
                        />
                        {templates.length === 0 && (
                            <ThemedText type="caption" style={{ textAlign: "center", marginTop: 8, color: ThemedColor.caption }}>
                                Create a recurring task to use this feature
                            </ThemedText>
                        )}
                    </View>
                )}

                {breakdownMode && (
                    <View style={[styles.breakdownActiveBar, { backgroundColor: ThemedColor.lightenedCard, borderColor: ThemedColor.primary }]}>
                        <ThemedText type="caption" style={{ color: ThemedColor.text }}>
                            Showing {selectedTemplateIds.length} recurring task{selectedTemplateIds.length !== 1 ? "s" : ""}
                        </ThemedText>
                        <TouchableOpacity
                            onPress={() => {
                                setBreakdownMode(false);
                                setSelectedTemplateIds([]);
                            }}>
                            <ThemedText type="caption" style={{ color: ThemedColor.primary }}>
                                Clear
                            </ThemedText>
                        </TouchableOpacity>
                    </View>
                )}

                {loading ? (
                    <ActivitySkeleton ThemedColor={ThemedColor} />
                ) : error ? (
                    <View style={styles.errorContainer}>
                        <ThemedText type="lightBody" style={styles.errorText}>
                            {error}
                        </ThemedText>
                    </View>
                ) : (
                    <View style={styles.dataContainer}>
                        {month_names.map((monthName, index) => {
                            const monthNumber = index + 1;
                            const currentDate = new Date();
                            const currentYear = currentDate.getFullYear();
                            const currentMonth = currentDate.getMonth() + 1; // 1-indexed

                            // Skip future months
                            if (year > currentYear || (year === currentYear && monthNumber > currentMonth)) {
                                return null;
                            }

                            const monthlyLevels = breakdownMode
                                ? getBreakdownActivityLevels(monthNumber)
                                : getMonthlyActivityLevels(activities, year, monthNumber);

                            return (
                                <View key={monthName} style={styles.monthContainer}>
                                    <ThemedText type="subtitle">{monthName}</ThemedText>
                                    <View>
                                        <View style={styles.activityPointsContainer}>
                                            {monthlyLevels.map((level, dayIndex) => {
                                                // Check if this day is in the future or is today
                                                const dayNumber = dayIndex + 1;
                                                const currentDate = new Date();
                                                const currentYear = currentDate.getFullYear();
                                                const currentMonth = currentDate.getMonth() + 1;
                                                const currentDay = currentDate.getDate();

                                                const isFuture =
                                                    year > currentYear ||
                                                    (year === currentYear && monthNumber > currentMonth) ||
                                                    (year === currentYear &&
                                                        monthNumber === currentMonth &&
                                                        dayNumber > currentDay);

                                                const isToday =
                                                    year === currentYear &&
                                                    monthNumber === currentMonth &&
                                                    dayNumber === currentDay;

                                                return (
                                                    <ActivityPoint
                                                        key={dayIndex}
                                                        level={level}
                                                        isFuture={isFuture}
                                                        isToday={isToday}
                                                        onPress={() => {
                                                            if (!isFuture && level > 0) {
                                                                const date = new Date(year, monthNumber - 1, dayNumber);
                                                                setSelectedDate(date);
                                                                setModalVisible(true);
                                                            }
                                                        }}
                                                    />
                                                );
                                            })}
                                        </View>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )}
            </ScrollView>
            <CompletedTasksBottomSheetModal 
                visible={modalVisible} 
                setVisible={setModalVisible} 
                date={selectedDate} 
            />
            <RecurringTasksSelectionModal
                visible={breakdownModalVisible}
                setVisible={setBreakdownModalVisible}
                templates={templates}
                selectedTemplateIds={selectedTemplateIds}
                onApply={(selectedIds) => {
                    setSelectedTemplateIds(selectedIds);
                    setBreakdownMode(selectedIds.length > 0);
                    setBreakdownModalVisible(false);
                }}
            />
        </ThemedView>
    );
};

export default Activity;

const stylesheet = (ThemedColor: any, insets: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: ThemedColor.background,
        },
        header: {
            flexDirection: "row",
            alignItems: "center",
            paddingTop: insets.top + 10,
            paddingBottom: 20,
            paddingHorizontal: HORIZONTAL_PADDING,
            borderBottomWidth: 1,
            borderBottomColor: ThemedColor.tertiary,
        },
        backButton: {
            marginRight: 16,
        },
        backArrow: {
            fontSize: 24,
            color: ThemedColor.text,
        },
        title: {
            fontSize: 24,
            color: ThemedColor.text,
        },
        scrollView: {
            flex: 1,
        },
        scrollContent: {
            paddingHorizontal: HORIZONTAL_PADDING,
            paddingTop: 20,
            paddingBottom: insets.bottom + 20,
            gap: 16,
        },
        subtitle: {
            textAlign: "center",
        },
        yearSelector: {
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            justifyContent: "space-between",
            borderWidth: 1,
            borderRadius: 24,
            padding: 8,
            borderColor: ThemedColor.text,
        },
        yearContainer: {
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
        },
        monthContainer: {
            marginTop: 24,
            gap: 16,
            alignSelf: "center",
        },
        activityPointsContainer: {
            flexWrap: "wrap",
            gap: 8,
            flexDirection: "row",
            width: "100%",
        },
        dataContainer: {
            flexDirection: "column-reverse",
            gap: 16,
            width: "100%",
            alignItems: "center",
        },
        loadingContainer: {
            alignItems: "center",
            paddingVertical: 40,
        },
        errorContainer: {
            alignItems: "center",
            paddingVertical: 40,
        },
        errorText: {
            color: "red",
        },
        breakdownButtonContainer: {
            width: "100%",
        },
        breakdownButton: {
            width: "100%",
        },
        breakdownActiveBar: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            borderWidth: 2,
            borderRadius: 12,
            padding: 12,
        },
    });

// Skeleton styles
const skeletonStyles = StyleSheet.create({
    container: {
        width: "100%",
        alignItems: "center",
        gap: 24,
        paddingVertical: 8,
    },
    monthContainer: {
        gap: 16,
        alignItems: "center",
        width: "100%",
        maxWidth: 350,
    },
    monthNameSkeleton: {
        width: 120,
        height: 24,
        borderRadius: 6,
    },
    activityGridContainer: {
        gap: 8,
        width: "100%",
    },
    activityRow: {
        flexDirection: "row",
        gap: 8,
        justifyContent: "center",
    },
    activityPointSkeleton: {
        width: 40,
        height: 40,
        borderRadius: 8,
    },
});

import { Dimensions, StyleSheet, View, ScrollView, TouchableOpacity, Animated } from "react-native";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import ActivityPoint from "@/components/profile/ActivityPoint";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { activityAPI, getMonthlyActivityLevels, ActivityDocument, calculateActivityLevel } from "@/api/activity";
import CompletedTasksBottomSheetModal from "@/components/modals/CompletedTasksBottomSheetModal";
import RecurringTasksSelectionModal from "@/components/modals/RecurringTasksSelectionModal";
import { getUserTemplatesAPI } from "@/api/task";
import { useAuth } from "@/hooks/useAuth";
import { RecurringTaskCard } from "@/components/activity/RecurringTaskCard";

const month_names = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

// Calculate the cell size so 7 columns + 6 gaps fit within the available width
const GRID_GAP = 4;
const GRID_PADDING = HORIZONTAL_PADDING;
const CELL_SIZE = Math.floor(
    (Dimensions.get("window").width - GRID_PADDING * 2 - GRID_GAP * 6) / 7
);

// --- Calendar Month Grid ---

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

    // Day-of-week the 1st falls on (0 = Sunday)
    const firstDayOffset = new Date(year, monthNumber - 1, 1).getDay();
    const daysInMonth = levels.length;
    const totalCells = firstDayOffset + daysInMonth;
    const rows = Math.ceil(totalCells / 7);

    return (
        <View style={calStyles.monthBlock}>
            <ThemedText type="defaultSemiBold" style={{ fontSize: 15 }}>
                {monthName}
            </ThemedText>

            {/* Weekday headers */}
            <View style={calStyles.weekRow}>
                {WEEKDAY_LABELS.map((label, i) => (
                    <View key={i} style={calStyles.cell}>
                        <ThemedText type="caption" style={{ fontSize: 10, color: ThemedColor.caption, textAlign: "center" }}>
                            {label}
                        </ThemedText>
                    </View>
                ))}
            </View>

            {/* Calendar rows */}
            {Array.from({ length: rows }).map((_, rowIdx) => (
                <View key={rowIdx} style={calStyles.weekRow}>
                    {Array.from({ length: 7 }).map((_, colIdx) => {
                        const cellIndex = rowIdx * 7 + colIdx;
                        const dayNumber = cellIndex - firstDayOffset + 1;

                        if (cellIndex < firstDayOffset || dayNumber > daysInMonth) {
                            return <View key={colIdx} style={calStyles.cell} />;
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
                            <View key={colIdx} style={calStyles.cell}>
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

const calStyles = StyleSheet.create({
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

// --- Skeleton Loader ---

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
        const rows = 5;
        return (
            <View key={key} style={skeletonStyles.monthContainer}>
                <Animated.View
                    style={[
                        skeletonStyles.monthNameSkeleton,
                        { backgroundColor: ThemedColor.tertiary, opacity },
                    ]}
                />
                {Array.from({ length: rows }).map((_, rowIndex) => (
                    <View key={rowIndex} style={skeletonStyles.activityRow}>
                        {Array.from({ length: 7 }).map((_, colIndex) => (
                            <Animated.View
                                key={colIndex}
                                style={[
                                    skeletonStyles.activityPointSkeleton,
                                    {
                                        backgroundColor: ThemedColor.tertiary,
                                        opacity: Animated.add(opacity, new Animated.Value(Math.random() * 0.2)),
                                    },
                                ]}
                            />
                        ))}
                    </View>
                ))}
            </View>
        );
    };

    return <View style={skeletonStyles.container}>{[0, 1, 2].map((i) => renderMonthSkeleton(i))}</View>;
};

// --- Main Activity Screen ---

const Activity = () => {
    const ThemedColor = useThemeColor();
    const { user } = useAuth();
    const [year, setYear] = useState(new Date().getFullYear());
    const [month] = useState(new Date().getMonth() + 1);
    const [activities, setActivities] = useState<ActivityDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [templates, setTemplates] = useState<any[]>([]);
    const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
    const [breakdownModalVisible, setBreakdownModalVisible] = useState(false);
    const [breakdownMode, setBreakdownMode] = useState(false);
    const [recurringTasksExpanded, setRecurringTasksExpanded] = useState(true);
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();

    const userId = user?._id || (params.id as string);
    const displayName = params.displayName as string || user?.display_name;
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

                try {
                    const userTemplates = await getUserTemplatesAPI();
                    setTemplates(userTemplates);
                } catch (templateErr) {
                    console.error("Failed to fetch templates:", templateErr);
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

    const getBreakdownActivityLevels = (targetMonth: number): number[] => {
        const daysInMonth = new Date(year, targetMonth, 0).getDate();
        const monthlyLevels: number[] = new Array(daysInMonth).fill(0);

        selectedTemplateIds.forEach((templateId) => {
            const template = templates.find((t) => t.id === templateId);
            if (!template?.completionDates) return;

            template.completionDates.forEach((dateStr: string) => {
                const date = new Date(dateStr);
                if (date.getFullYear() === year && date.getMonth() + 1 === targetMonth) {
                    const day = date.getDate();
                    if (day >= 1 && day <= daysInMonth) {
                        monthlyLevels[day - 1]++;
                    }
                }
            });
        });

        return monthlyLevels.map((count) => calculateActivityLevel(count));
    };

    const handleToggleTemplate = (templateId: string) => {
        setSelectedTemplateIds(prev => {
            if (prev.includes(templateId)) {
                const newIds = prev.filter(id => id !== templateId);
                if (newIds.length === 0) {
                    setBreakdownMode(false);
                }
                return newIds;
            } else {
                setBreakdownMode(true);
                return [...prev, templateId];
            }
        });
    };

    return (
        <ThemedView style={styles.container}>
            <View style={styles.header}>
                <ThemedText type="fancyFrauncesHeading" style={styles.title}>
                    {params.displayName ? `${displayName}'s Activity` : "My Activity"}
                </ThemedText>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Recurring Tasks Section */}
                {templates.length > 0 && (
                    <View style={styles.recurringSection}>
                        <TouchableOpacity
                            style={styles.sectionHeader}
                            onPress={() => setRecurringTasksExpanded(!recurringTasksExpanded)}
                            activeOpacity={0.7}
                        >
                            <ThemedText type="caption" style={{ color: ThemedColor.caption }}>
                                {recurringTasksExpanded ? "TAP TO FILTER" : `${templates.length} TASK${templates.length !== 1 ? 'S' : ''}`}
                            </ThemedText>
                            <Ionicons
                                name={recurringTasksExpanded ? "chevron-up" : "chevron-down"}
                                size={16}
                                color={ThemedColor.caption}
                            />
                        </TouchableOpacity>

                        {recurringTasksExpanded && (
                            <View style={styles.taskList}>
                                {templates.map((template) => (
                                    <RecurringTaskCard
                                        key={template.id}
                                        templateId={template.id}
                                        taskName={template.content}
                                        categoryName={template.categoryName}
                                        completionDates={template.completionDates || []}
                                        year={year}
                                        month={month}
                                        isSelected={selectedTemplateIds.includes(template.id)}
                                        recurType={template.recurType}
                                        recurFrequency={template.recurFrequency}
                                        streak={template.streak}
                                        timesMissed={template.timesMissed}
                                        onToggle={handleToggleTemplate}
                                    />
                                ))}
                            </View>
                        )}
                    </View>
                )}

                {templates.length === 0 && !loading && (
                    <View style={styles.emptyState}>
                        <ThemedText type="caption" style={{ textAlign: "center", color: ThemedColor.caption }}>
                            No recurring tasks yet. Create one to track your habits!
                        </ThemedText>
                    </View>
                )}

                {/* Activity Heatmap */}
                {loading ? (
                    <ActivitySkeleton ThemedColor={ThemedColor} />
                ) : error ? (
                    <View style={styles.errorContainer}>
                        <ThemedText type="lightBody" style={{ color: ThemedColor.error }}>
                            {error}
                        </ThemedText>
                    </View>
                ) : !userId ? (
                    <View style={styles.errorContainer}>
                        <ThemedText type="lightBody" style={{ color: ThemedColor.error }}>
                            No user ID provided
                        </ThemedText>
                    </View>
                ) : (
                    <View style={styles.heatmapContainer}>
                        {month_names.map((monthName, index) => {
                            const monthNumber = index + 1;
                            const currentDate = new Date();
                            const currentYear = currentDate.getFullYear();
                            const currentMonth = currentDate.getMonth() + 1;

                            if (year > currentYear || (year === currentYear && monthNumber > currentMonth)) {
                                return null;
                            }

                            const monthlyLevels = breakdownMode
                                ? getBreakdownActivityLevels(monthNumber)
                                : getMonthlyActivityLevels(activities, year, monthNumber);

                            return (
                                <CalendarMonth
                                    key={monthName}
                                    monthName={monthName}
                                    year={year}
                                    monthNumber={monthNumber}
                                    levels={monthlyLevels}
                                    ThemedColor={ThemedColor}
                                    onDayPress={(dayNumber) => {
                                        setSelectedDate(new Date(year, monthNumber - 1, dayNumber));
                                        setModalVisible(true);
                                    }}
                                />
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

// --- Page Styles ---

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
            paddingBottom: 16,
            paddingHorizontal: HORIZONTAL_PADDING,
            borderBottomWidth: 1,
            borderBottomColor: ThemedColor.tertiary,
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
            paddingTop: 16,
            paddingBottom: insets.bottom + 80,
            gap: 8,
        },
        recurringSection: {
            width: "100%",
            marginBottom: 8,
        },
        sectionHeader: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: 8,
        },
        taskList: {
            gap: 2,
        },
        heatmapContainer: {
            flexDirection: "column-reverse",
            gap: 0,
            width: "100%",
        },
        emptyState: {
            width: "100%",
            padding: 24,
            alignItems: "center",
        },
        errorContainer: {
            alignItems: "center",
            paddingVertical: 40,
        },
    });

// --- Skeleton Styles ---

const skeletonStyles = StyleSheet.create({
    container: {
        width: "100%",
        gap: 24,
        paddingVertical: 8,
    },
    monthContainer: {
        gap: 4,
        width: "100%",
    },
    monthNameSkeleton: {
        width: 100,
        height: 20,
        borderRadius: 4,
        marginBottom: 4,
    },
    activityRow: {
        flexDirection: "row",
        gap: GRID_GAP,
    },
    activityPointSkeleton: {
        width: CELL_SIZE,
        height: CELL_SIZE,
        borderRadius: 6,
    },
});

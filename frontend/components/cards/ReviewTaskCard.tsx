import React from "react";
import { View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { AnimatedStyle } from "react-native-reanimated";
import TinderCard from "react-tinder-card";
import { CalendarBlank, Clock, Repeat } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Task } from "@/api/types";
import TaskChip from "./TaskChip";
import { getTimeChipInfo } from "@/utils/timeChip";

const PRIORITY_LABELS: Record<number, string> = {
    1: "Low",
    2: "Medium",
    3: "High",
};

type Props = {
    task: Task;
    animatedCardStyle: AnimatedStyle;
    animatedIndicatorStyle: AnimatedStyle;
    animatedIndicatorTextStyle: AnimatedStyle;
    swipeDirection: string | null;
    onSwipe: (direction: string, task: Task) => void;
    onCardLeftScreen: () => void;
    cardRef: (el: any) => void;
};

const ReviewTaskCard = ({
    task,
    animatedCardStyle,
    animatedIndicatorStyle,
    animatedIndicatorTextStyle,
    swipeDirection,
    onSwipe,
    onCardLeftScreen,
    cardRef,
}: Props) => {
    const ThemedColor = useThemeColor();
    const priorityColor: Record<number, string> = {
        1: ThemedColor.success,
        2: ThemedColor.warning,
        3: ThemedColor.error,
    };
    const timeChip = getTimeChipInfo(task, true);

    return (
        <Animated.View
            style={[
                styles.cardContainer,
                animatedCardStyle as any,
            ]}
        >
            <TinderCard
                key={task?.id || "mwo"}
                onSwipe={(direction) => onSwipe(direction, task)}
                ref={cardRef}
                onCardLeftScreen={onCardLeftScreen}
            >
                <View style={[
                    styles.cardContent,
                    {
                        borderColor: ThemedColor.tertiary,
                        backgroundColor: ThemedColor.lightenedCard,
                    },
                ]}>
                    {/* Hero: category eyebrow, big title, chips for what actually exists */}
                    <View style={styles.hero}>
                        <ThemedText
                            type="caption"
                            style={[styles.categoryName, { color: ThemedColor.caption }]}
                            numberOfLines={1}
                        >
                            {task?.categoryName || "Uncategorized"}
                        </ThemedText>
                        <ThemedText type="fancyFrauncesSubheading" numberOfLines={4} style={styles.taskTitle}>
                            {task?.content || ""}
                        </ThemedText>
                        <View style={styles.chipsRow}>
                            {!!task?.priority && (
                                <TaskChip
                                    label={PRIORITY_LABELS[task.priority]}
                                    color={priorityColor[task.priority]}
                                />
                            )}
                            {timeChip && (
                                <TaskChip
                                    label={timeChip.label}
                                    tone={timeChip.tone}
                                    Icon={timeChip.icon === "clock" ? Clock : CalendarBlank}
                                />
                            )}
                            {task?.recurring && <TaskChip Icon={Repeat} label="repeats" />}
                        </View>
                    </View>

                    <View style={{ flex: 1 }} />

                    {task?.notes ? (
                        <View style={styles.notesSection}>
                            <ThemedText type="caption" style={[styles.notesLabel, { color: ThemedColor.caption }]}>
                                NOTES
                            </ThemedText>
                            <ThemedText type="lightBody" numberOfLines={4} style={{ color: ThemedColor.caption }}>
                                {task.notes}
                            </ThemedText>
                        </View>
                    ) : null}

                    {/* Directional gradient wash — fills the full card */}
                    {swipeDirection && (
                        <Animated.View
                            style={[styles.swipeIndicator, animatedIndicatorStyle as any]}
                            pointerEvents="none"
                        >
                            <LinearGradient
                                colors={
                                    swipeDirection === 'right'
                                        ? [ThemedColor.success + 'BB', ThemedColor.success + '00']
                                        : swipeDirection === 'down'
                                        ? [ThemedColor.error + 'CC', ThemedColor.error + '00']
                                        : swipeDirection === 'up'
                                        ? [ThemedColor.primary + '00', ThemedColor.primary + 'CC']
                                        : [ThemedColor.text + '00', ThemedColor.text + '66']
                                }
                                start={
                                    swipeDirection === 'right' ? { x: 0, y: 0.5 }
                                    : swipeDirection === 'down' ? { x: 0.5, y: 0 }
                                    : swipeDirection === 'up' ? { x: 0.5, y: 0 }
                                    : { x: 0, y: 0.5 }
                                }
                                end={
                                    swipeDirection === 'right' ? { x: 1, y: 0.5 }
                                    : swipeDirection === 'down' ? { x: 0.5, y: 1 }
                                    : swipeDirection === 'up' ? { x: 0.5, y: 1 }
                                    : { x: 1, y: 0.5 }
                                }
                                style={styles.swipeGradient}
                            />
                            <Animated.Text
                                style={[
                                    styles.swipeIndicatorText,
                                    animatedIndicatorTextStyle as any,
                                    swipeDirection === 'right' ? styles.labelLeft
                                    : swipeDirection === 'down' ? styles.labelTop
                                    : swipeDirection === 'up' ? styles.labelBottom
                                    : styles.labelRight,
                                ]}
                            >
                                {swipeDirection === 'left' && 'skip'}
                                {swipeDirection === 'right' && 'done ✓'}
                                {swipeDirection === 'down' && 'delete'}
                                {swipeDirection === 'up' && 'in progress'}
                            </Animated.Text>
                        </Animated.View>
                    )}
                </View>
            </TinderCard>
        </Animated.View>
    );
};

export default ReviewTaskCard;

const styles = StyleSheet.create({
    cardContainer: {
        position: "absolute",
        width: "100%",
        height: "100%",
        zIndex: 10,
    },
    cardContent: {
        width: "100%",
        height: "100%",
        borderRadius: 20,
        borderWidth: 1,
        padding: 24,
        overflow: "hidden",
        flexDirection: "column",
    },
    hero: {
        gap: 12,
        paddingTop: 8,
    },
    categoryName: {
        fontSize: 12,
        letterSpacing: 1.2,
        textTransform: "uppercase",
    },
    taskTitle: {
        fontSize: 30,
        lineHeight: 38,
    },
    chipsRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 6,
        marginTop: 4,
    },
    notesSection: {
        gap: 6,
        paddingBottom: 4,
    },
    notesLabel: {
        fontSize: 11,
        letterSpacing: 1.2,
    },
    swipeIndicator: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: 20,
        zIndex: 100,
    },
    swipeGradient: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: 20,
    },
    swipeIndicatorText: {
        position: "absolute",
        fontSize: 24,
        fontWeight: "700",
        letterSpacing: 0.3,
        fontFamily: "Outfit",
        color: "#ffffff",
    },
    labelLeft: {
        left: 24,
        top: 24,
    },
    labelRight: {
        right: 24,
        top: 24,
    },
    labelTop: {
        top: 24,
        left: 0,
        right: 0,
        textAlign: "center",
    },
    labelBottom: {
        bottom: 24,
        left: 0,
        right: 0,
        textAlign: "center",
    },
});

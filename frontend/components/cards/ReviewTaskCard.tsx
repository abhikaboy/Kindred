import React from "react";
import { View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { AnimatedStyle } from "react-native-reanimated";
import TinderCard from "react-tinder-card";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Task } from "@/api/types";
import ReviewTaskRow from "./ReviewTaskRow";

// priority: 1 = low (green), 2 = medium (yellow), 3 = high (red)
const PRIORITY_COLORS: Record<number, string> = {
    1: "#4CAF50",
    2: "#FFC107",
    3: "#F44336",
};
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
                        backgroundColor: ThemedColor.background,
                    },
                ]}>
                    {/* Metadata rows — top of card */}
                    <View style={styles.rows}>
                        <ReviewTaskRow
                            label="Priority"
                            value=""
                            empty={!task?.priority}
                            rightContent={
                                <View style={styles.priorityRow}>
                                    <View style={[
                                        styles.trafficDot,
                                        { backgroundColor: PRIORITY_COLORS[task?.priority ?? 2] ?? PRIORITY_COLORS[2] },
                                    ]} />
                                    <ThemedText type="default" style={styles.priorityLabel}>
                                        {PRIORITY_LABELS[task?.priority ?? 2] ?? "Medium"}
                                    </ThemedText>
                                </View>
                            }
                        />
                        <ReviewTaskRow
                            label="Notes"
                            value={task?.notes || "No notes"}
                            empty={!task?.notes}
                            numberOfLines={2}
                        />
                        <ReviewTaskRow
                            label="Start"
                            value={
                                task?.startDate
                                    ? new Date(task.startDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                                    : "No start date"
                            }
                            empty={!task?.startDate}
                            numberOfLines={1}
                        />
                        <ReviewTaskRow
                            label="Deadline"
                            value={
                                task?.deadline
                                    ? new Date(task.deadline).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                                    : "No deadline"
                            }
                            empty={!task?.deadline}
                            numberOfLines={1}
                        />
                    </View>

                    {/* Spacer pushes title to bottom */}
                    <View style={{ flex: 1 }} />

                    <View style={styles.bottomSection}>
                        <ThemedText
                            style={[styles.categoryName, { color: ThemedColor.caption }]}
                            numberOfLines={1}
                        >
                            {task?.categoryName || "Uncategorized"}
                        </ThemedText>
                        <ThemedText type="title" numberOfLines={3} style={styles.taskTitle}>
                            {task?.content || ""}
                        </ThemedText>
                    </View>

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
                                        : [ThemedColor.text + '00', ThemedColor.text + '66']
                                }
                                start={
                                    swipeDirection === 'right' ? { x: 0, y: 0.5 }
                                    : swipeDirection === 'down' ? { x: 0.5, y: 0 }
                                    : { x: 0, y: 0.5 }
                                }
                                end={
                                    swipeDirection === 'right' ? { x: 1, y: 0.5 }
                                    : swipeDirection === 'down' ? { x: 0.5, y: 1 }
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
                                    : styles.labelRight,
                                ]}
                            >
                                {swipeDirection === 'left' && 'skip'}
                                {swipeDirection === 'right' && 'done ✓'}
                                {swipeDirection === 'down' && 'delete'}
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
        paddingTop: 20,
        paddingHorizontal: 20,
        paddingBottom: 0,
        overflow: "hidden",
        flexDirection: "column",
    },
    rows: {
        gap: 0,
    },
    bottomSection: {
        paddingHorizontal: 0,
        paddingTop: 12,
        paddingBottom: 24,
    },
    categoryName: {
        fontSize: 13,
        fontWeight: "600",
        letterSpacing: 0.5,
        textTransform: "uppercase",
        marginBottom: 6,
    },
    taskTitle: {
        lineHeight: 36,
    },
    priorityRow: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    trafficDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    priorityLabel: {
        fontSize: 16,
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
});

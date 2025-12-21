import React from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import Animated, { AnimatedStyle } from "react-native-reanimated";
import TinderCard from "react-tinder-card";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Task } from "@/api/types";
import ReviewTaskRow from "./ReviewTaskRow";

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
                    <View>
                        <ReviewTaskRow label="Priority" value={task?.priority ?? 0} />
                        <ReviewTaskRow 
                            label="Notes" 
                            value={task?.notes || "No notes"} 
                            empty={!task?.notes}
                        />
                        <ReviewTaskRow 
                            label="Checklist" 
                            value={
                                task?.checklist?.length > 0 
                                    ? task.checklist.map((item) => item.content).join(", ") 
                                    : "No checklist"
                            }
                            empty={!task?.checklist || task.checklist.length === 0}
                        />
                        <ReviewTaskRow 
                            label="Start Time" 
                            value={
                                task?.startTime 
                                    ? new Date(task.startTime).toLocaleTimeString() 
                                    : "No start time"
                            }
                            empty={!task?.startTime}
                        />
                        <ReviewTaskRow 
                            label="Start Date" 
                            value={
                                task?.startDate 
                                    ? new Date(task.startDate).toLocaleDateString() 
                                    : "No start date"
                            }
                            empty={!task?.startDate}
                        />
                        <ReviewTaskRow 
                            label="Deadline" 
                            value={
                                task?.deadline 
                                    ? new Date(task.deadline).toLocaleDateString() 
                                    : "No deadline"
                            }
                            empty={!task?.deadline}
                        />
                    </View>
                    <View style={styles.bottomSection}>
                        <ThemedText type="defaultSemiBold" style={styles.categoryName}>
                            {task?.categoryName || "Uncategorized"}
                        </ThemedText>
                        <ThemedText type="title">
                            {task?.content || ""}
                        </ThemedText>
                    </View>

                    {/* Swipe direction indicators */}
                    {swipeDirection && (
                        <Animated.View 
                            style={[
                                styles.swipeIndicator,
                                animatedIndicatorStyle as any,
                                { borderWidth: 1 },
                                {
                                    backgroundColor: swipeDirection === 'left' 
                                        ? ThemedColor.text + '60'
                                        : swipeDirection === 'right'
                                        ? ThemedColor.success + '50'
                                        : ThemedColor.error + '50',
                                },
                                {
                                    borderColor: swipeDirection === 'left'
                                        ? ThemedColor.text + '90'
                                        : swipeDirection === 'right'
                                        ? ThemedColor.success + '90'
                                        : ThemedColor.error + '90',
                                },
                            ]}
                        >
                            <Animated.Text 
                                style={[
                                    styles.swipeIndicatorText,
                                    animatedIndicatorTextStyle as any,
                                    {
                                        color: swipeDirection === 'left' 
                                            ? ThemedColor.text 
                                            : swipeDirection === 'right'
                                            ? ThemedColor.success
                                            : ThemedColor.error,
                                    },
                                ]}
                            >
                                {swipeDirection === 'left' && 'SKIP'}
                                {swipeDirection === 'right' && 'COMPLETE'}
                                {swipeDirection === 'down' && 'DELETE'}
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
        borderRadius: 12,
        borderWidth: 1,
        padding: 16,
        justifyContent: "space-between",
    },
    bottomSection: {
        flex: 1,
        justifyContent: "flex-end",
    },
    categoryName: {
        marginBottom: 4,
    },
    swipeIndicator: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: "center",
        alignItems: "center",
        borderRadius: 12,
        zIndex: 100,
    },
    swipeIndicatorText: {
        fontSize: 48,
        fontWeight: "500",
        fontStyle: "italic",
        textTransform: "lowercase",
        fontFamily: "Fraunces",
        letterSpacing: -2,
    },
});


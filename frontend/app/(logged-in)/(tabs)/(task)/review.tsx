import { Dimensions, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import React, { useState, useEffect, useRef, useMemo } from "react";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, Easing } from "react-native-reanimated";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import Ionicons from "@expo/vector-icons/Ionicons";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useRouter } from "expo-router";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { useTasks } from "@/contexts/tasksContext";
import TinderCard from "react-tinder-card";
import TaskCard from "@/components/cards/TaskCard";
import { Task } from "@/api/types";
import ConditionalView from "@/components/ui/ConditionalView";
type Props = {};

const Review = (props: Props) => {
    const ThemedColor = useThemeColor();
    const router = useRouter();
    const { fetchWorkspaces, unnestedTasks } = useTasks();
    const [isLoading, setIsLoading] = useState(false);
    const childRefs = useRef<{ [key: number]: any }>({});
    const [removedTasks, setRemovedTasks] = useState<string[]>([]);
    
    // Filter out removed tasks and update cards when unnestedTasks or removedTasks change
    const cards = useMemo(() => {
        return unnestedTasks.filter((task) => !removedTasks.includes(task.id));
    }, [unnestedTasks, removedTasks]);
    
    // Always show the first card in the filtered array (index 0)
    // When a card is removed, the next card automatically moves to index 0
    const currentTask = useMemo(() => {
        return cards.length > 0 ? cards[0] : null;
    }, [cards]);
    
    // Track when stack is empty
    const emptyStack = useMemo(() => {
        return cards.length === 0;
    }, [cards]);
    
    // Animation values for fade out and scale in
    const fadeOpacity = useSharedValue(1);
    const scale = useSharedValue(0.9);
    
    // Animated styles
    const animatedCardStyle = useAnimatedStyle(() => ({
        opacity: fadeOpacity.value,
        transform: [{ scale: scale.value }],
    }));
    
    // Reset animations when currentTask changes (new card mounts)
    useEffect(() => {
        if (currentTask) {
            // Scale in animation for new card
            scale.value = 0.8;
            scale.value = withTiming(1, {
            });
            // Reset fade opacity
            fadeOpacity.value = 1;
        }
    }, [currentTask?.id]);
    
    const onSwipe = (direction: string, task: Task) => {
        console.log('You swiped: ' + direction);
        if (!task) return;
        
        // Start fade out animation immediately
        fadeOpacity.value = withTiming(0, {
            duration: 300,
            easing: Easing.out(Easing.ease),
        });
        
        // Add task to removed tasks - this will cause cards array to update
        // Use a delay to allow the fade animation to complete
        setTimeout(() => {
            setRemovedTasks((prev) => {
                if (prev.includes(task.id)) {
                    return prev; // Already removed, don't add again
                }
                return [...prev, task.id];
            });
        }, 300);
    };

    const outOfFrame = (index: number, id: string) => {
        console.log(index + " left the screen!");
        // Card has left the screen, the cards array has been filtered
        // The next card is now at index 0, and currentTask will update automatically via useMemo
    };

    return (    
        <ThemedView style={{  }}>
            <View 
                style={[styles.container, { flex: 1 }]}>
                {/* Back Button */}
                <TouchableOpacity 
                    onPress={() => router.back()}
                    style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color={ThemedColor.text} />
                </TouchableOpacity>

                {/* Header */}
                <View style={styles.headerContainer}>
                    <ThemedText type="fancyFrauncesHeading" style={styles.title}>
                        Task Review
                    </ThemedText>
                    <ThemedText 
                        type="default" 
                        style={[styles.subtitle, { color: ThemedColor.caption }]}>
                        Swipe right to mark tasks as completed, swipe left to skip.
                    </ThemedText>
                </View>

                <ConditionalView condition={!emptyStack && currentTask != null} style={styles.taskContainer}>
                    <View style={{ position: "relative", width: "100%", height: Dimensions.get("window").width * 0.7 }}>
                        {/* Skeleton card underneath - always visible */}
                        <View
                            style={[
                                styles.skeletonCard,
                                {
                                    borderColor: ThemedColor.tertiary,
                                    transform: [{ translateY: 8 }],
                                },
                            ]}
                        >
                            <View style={{
                                width: "100%",
                                height: "100%",
                                borderRadius: 12,
                                borderWidth: 1,
                                borderColor: ThemedColor.tertiary,
                                padding: 16,
                                justifyContent: "space-between",
                            }}>
                                <View>
                                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                                        <View style={{ width: 60, height: 16, backgroundColor: ThemedColor.tertiary, borderRadius: 4, opacity: 0.3 }} />
                                        <View style={{ width: 40, height: 16, backgroundColor: ThemedColor.tertiary, borderRadius: 4, opacity: 0.3 }} />
                                    </View>
                                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                                        <View style={{ width: 50, height: 16, backgroundColor: ThemedColor.tertiary, borderRadius: 4, opacity: 0.3 }} />
                                        <View style={{ width: 100, height: 16, backgroundColor: ThemedColor.tertiary, borderRadius: 4, opacity: 0.3 }} />
                                    </View>
                                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                                        <View style={{ width: 70, height: 16, backgroundColor: ThemedColor.tertiary, borderRadius: 4, opacity: 0.3 }} />
                                        <View style={{ width: 120, height: 16, backgroundColor: ThemedColor.tertiary, borderRadius: 4, opacity: 0.3 }} />
                                    </View>
                                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                                        <View style={{ width: 80, height: 16, backgroundColor: ThemedColor.tertiary, borderRadius: 4, opacity: 0.3 }} />
                                        <View style={{ width: 90, height: 16, backgroundColor: ThemedColor.tertiary, borderRadius: 4, opacity: 0.3 }} />
                                    </View>
                                </View>
                                <View style={{ flex: 1, justifyContent: "flex-end" }}>
                                    <View style={{ width: 100, height: 16, backgroundColor: ThemedColor.tertiary, borderRadius: 4, opacity: 0.3, marginBottom: 8 }} />
                                    <View style={{ width: "75%", height: 24, backgroundColor: ThemedColor.tertiary, borderRadius: 4, opacity: 0.3 }} />
                                </View>
                            </View>
                        </View>
                        
                        {/* Main card with animations - on top */}
                        <Animated.View
                            style={[
                                {
                                    position: "absolute",
                                    width: "100%",
                                    height: "100%",
                                    zIndex: 10,
                                },
                                animatedCardStyle,
                            ]}
                        >
                            <TinderCard
                                key={currentTask?.id || "mwo"}
                                onSwipe={(direction) => onSwipe(direction, currentTask)}
                                ref={(el) => (childRefs.current[0] = el)}
                                onCardLeftScreen={() => outOfFrame(0, currentTask.id)}
                            >
                                <View style={{
                                    width: "100%",
                                    height: "100%",
                                    borderRadius: 12,
                                    borderWidth: 1,
                                    borderColor: ThemedColor.tertiary,
                                    backgroundColor: ThemedColor.background,
                                    padding: 16,
                                    justifyContent: "space-between",
                                }}>
                                <View>
                                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                                    <ThemedText type="default">Priority</ThemedText>
                                    <ThemedText type="default">{currentTask?.priority ?? 0}</ThemedText>
                                </View>
                                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>  
                                    <ThemedText type="default">Notes</ThemedText>
                                    <ThemedText type="default">{currentTask?.notes || "No notes"}</ThemedText>
                                </View>
                                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                                    <ThemedText type="default">Checklist</ThemedText>
                                    <ThemedText type="default">{currentTask?.checklist?.length > 0 ? currentTask.checklist.map((item) => item.content).join(", ") : "No checklist"}</ThemedText>
                                </View>
                                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                                    <ThemedText type="default">Start Time</ThemedText>
                                    <ThemedText type="default">
                                        {currentTask?.startTime ? new Date(currentTask.startTime).toLocaleTimeString() : "No start time"}
                                    </ThemedText>
                                </View>
                                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                                    <ThemedText type="default">Start Date</ThemedText>
                                    <ThemedText type="default">
                                        {currentTask?.startDate ? new Date(currentTask.startDate).toLocaleDateString() : "No start date"}
                                    </ThemedText>
                                </View>
                                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                                    <ThemedText type="default">Deadline</ThemedText>
                                    <ThemedText type="default">
                                        {currentTask?.deadline ? new Date(currentTask.deadline).toLocaleDateString() : "No deadline"}
                                    </ThemedText>
                                </View>
                                </View>
                                <View style={{ flex: 1, justifyContent: "flex-end" }}>
                                    <ThemedText type="defaultSemiBold" style={{ marginBottom: 4 }}>
                                        {currentTask?.categoryName || "Uncategorized"}
                                    </ThemedText>
                                    <ThemedText type="title">
                                        {currentTask?.content || ""}
                                    </ThemedText>
                                </View>

                                </View>
                            </TinderCard>
                        </Animated.View>
                    </View>
                <View>
                    <ThemedText type="default">
                        {cards.length} remaining 
                    </ThemedText>
                </View>
                </ConditionalView>

                <ConditionalView condition={emptyStack && unnestedTasks.length > 0} style={styles.taskContainer}>
                    <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 32 }}>
                        <ThemedText type="title" style={{ textAlign: "center", marginBottom: 8 }}>
                            🎉 All Done!
                        </ThemedText>
                        <ThemedText type="default" style={{ textAlign: "center", color: ThemedColor.caption }}>
                            You've reviewed all {unnestedTasks.length} tasks. Great work!
                        </ThemedText>
                    </View>
                </ConditionalView>

                <ConditionalView condition={unnestedTasks.length === 0} style={styles.taskContainer}>
                    <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 32 }}>
                        <ThemedText type="title" style={{ textAlign: "center", marginBottom: 8 }}>
                            No Tasks to Review
                        </ThemedText>
                        <ThemedText type="default" style={{ textAlign: "center", color: ThemedColor.caption }}>
                            Create some tasks to get started!
                        </ThemedText>
                    </View>
                </ConditionalView>
                {/* Mark All as Completed Button */}
                <View style={styles.generateButtonContainer}>
                    <PrimaryButton
                        title={emptyStack ? "Return":"Mark All as Completed"}
                        onPress={() => {
                            console.log("Mark all as completed");
                            router.back()
                        }}
                    />
                </View>

            </View>

        </ThemedView>
    );
};

export default Review;

const styles = StyleSheet.create({
    container: {
        paddingTop: Dimensions.get("screen").height * 0.07,
        paddingHorizontal: HORIZONTAL_PADDING,
    },
    scrollContent: {
        flexGrow: 1,
        paddingBottom: 120, // Extra padding for tab bar
    },
    backButton: {
        marginBottom: 16,
    },
    headerContainer: {
        paddingBottom: 24,
        paddingTop: 4,
        gap: 8,
    },
    title: {
        fontWeight: "600",
    },
    subtitle: {
        fontSize: 14,
    },
    creditsContainer: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        marginTop: 16,
    },
    creditsLabel: {
        fontSize: 11,
        fontWeight: "600",
    },
    creditsValue: {
        flexDirection: "row",
        alignItems: "center",
    },
    textInputSection: {
        marginBottom: 16,
    },
    textInput: {
        fontSize: 16,
        lineHeight: 24,
        padding: 16,
        borderWidth: 1,
        borderRadius: 12,
        minHeight: 200,
        fontFamily: "Outfit",
    },
    taskContainer: {
        paddingVertical: 16,
        gap: 4,
    },
    characterCountSection: {
        alignItems: "flex-end",
        paddingHorizontal: 4,
    },
    characterCount: {
        fontSize: 12,
    },
    generateButtonContainer: {
        paddingVertical: 16,
        width: "100%",
    },
    skeletonCard: {
        position: "absolute",
        width: "100%",
        height: "100%",
        borderRadius: 12,
        borderWidth: 1,
        backgroundColor: "transparent",
    },
});


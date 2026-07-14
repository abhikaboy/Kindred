import { Dimensions, ScrollView, StyleSheet, TextInput, TouchableOpacity, View, Alert } from "react-native";
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
import { Task } from "@/api/types";
import ConditionalView from "@/components/ui/ConditionalView";
import { markAsCompletedAPI, markInProgressAPI } from "@/api/task";
import { useUndoableDelete } from "@/hooks/useUndoableDelete";
import { useDebounce } from "@/hooks/useDebounce";
import ReviewCardStack from "@/components/cards/ReviewCardStack";
import ReviewTaskCard from "@/components/cards/ReviewTaskCard";
import { useQueryClient } from "@tanstack/react-query";
import { Check, PlayCircle, Trash, X } from "phosphor-react-native";
import GlowBackground, { GlowBlob } from "@/components/ui/GlowBackground";
import { hapticCompletionBurst, hapticLight } from "@/utils/haptics";
type Props = {};

// hugs the exposed edges — the card covers the screen center, so a centered glow vanishes
const REVIEW_GLOW: GlowBlob[] = [
    { color: "#854DFF", opacity: { dark: 0.08, light: 0.08 }, cx: 50, cy: 6, rx: 48, ry: 18, falloff: "60%" },
    { color: "#4D9EFF", opacity: { dark: 0.06, light: 0.09 }, cx: 50, cy: 94, rx: 42, ry: 16 },
];

type ReviewActionsProps = {
    onSkip: () => void;
    onDelete: () => void;
    onInProgress: () => void;
    onDone: () => void;
    ThemedColor: any;
};

// Tinder-style controls mirroring the swipe directions: skip ← / delete ↓ / done → / in progress ↑
const ReviewActions = ({ onSkip, onDelete, onInProgress, onDone, ThemedColor }: ReviewActionsProps) => (
    <View style={styles.actionsRow}>
        <View style={styles.actionItem}>
            <TouchableOpacity
                onPress={onSkip}
                accessibilityRole="button"
                accessibilityLabel="Skip this task"
                style={[
                    styles.actionButton,
                    styles.actionMedium,
                    { borderColor: ThemedColor.tertiary, backgroundColor: ThemedColor.background },
                ]}>
                <X size={24} color={ThemedColor.caption} weight="bold" />
            </TouchableOpacity>
            <ThemedText type="caption" style={{ color: ThemedColor.caption }}>
                skip
            </ThemedText>
        </View>
        <View style={styles.actionItem}>
            <TouchableOpacity
                onPress={onDelete}
                accessibilityRole="button"
                accessibilityLabel="Delete this task"
                style={[
                    styles.actionButton,
                    styles.actionSmall,
                    { borderColor: ThemedColor.error + "66", backgroundColor: ThemedColor.background },
                ]}>
                <Trash size={20} color={ThemedColor.error} weight="regular" />
            </TouchableOpacity>
            <ThemedText type="caption" style={{ color: ThemedColor.caption }}>
                delete
            </ThemedText>
        </View>
        <View style={styles.actionItem}>
            <TouchableOpacity
                onPress={onInProgress}
                accessibilityRole="button"
                accessibilityLabel="Mark task as in progress"
                style={[
                    styles.actionButton,
                    styles.actionSmall,
                    { borderColor: ThemedColor.primary + "66", backgroundColor: ThemedColor.background },
                ]}>
                <PlayCircle size={20} color={ThemedColor.primary} weight="regular" />
            </TouchableOpacity>
            <ThemedText type="caption" style={{ color: ThemedColor.caption }}>
                in progress
            </ThemedText>
        </View>
        <View style={styles.actionItem}>
            <TouchableOpacity
                onPress={onDone}
                accessibilityRole="button"
                accessibilityLabel="Mark task as done"
                style={[styles.actionButton, styles.actionLarge, { backgroundColor: ThemedColor.primary }]}>
                <Check size={30} color="#FFFFFF" weight="bold" />
            </TouchableOpacity>
            <ThemedText type="caption" style={{ color: ThemedColor.caption }}>
                done
            </ThemedText>
        </View>
    </View>
);

const Review = (props: Props) => {
    const ThemedColor = useThemeColor();
    const router = useRouter();
    const { fetchWorkspaces, unnestedTasks, addToCategory, updateTask } = useTasks();
    const queryClient = useQueryClient();
    const { deleteWithUndo, alertElement } = useUndoableDelete();
    const [isLoading, setIsLoading] = useState(false);
    const childRefs = useRef<{ [key: number]: any }>({});
    const [removedTasks, setRemovedTasks] = useState<string[]>([]);
    const [processingTasks, setProcessingTasks] = useState<Set<string>>(new Set());

    // Debounce fetchWorkspaces with 8 second delay
    const debouncedFetchWorkspaces = useDebounce(() => {
        fetchWorkspaces();
    }, 5000);

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

    // Swipe tracking using shared values (runs on UI thread, no re-renders)
    const swipeProgress = useSharedValue(0); // 0 to 1, based on swipe distance
    const swipeDirectionValue = useSharedValue<'left' | 'right' | 'down' | 'up' | null>(null);
    const touchStartRef = useRef<{ x: number; y: number } | null>(null);
    const screenWidth = Dimensions.get("window").width;

    // Only use React state for conditional rendering (updated less frequently)
    const [swipeDirection, setSwipeDirection] = useState<string | null>(null);

    // Animated styles
    const animatedCardStyle = useAnimatedStyle(() => ({
        opacity: fadeOpacity.value,
        transform: [{ scale: scale.value }],
    }));

    // Animated style for swipe indicator (runs on UI thread)
    const animatedIndicatorStyle = useAnimatedStyle(() => {
        const progress = swipeProgress.value;
        const direction = swipeDirectionValue.value;
        const opacity = progress * 0.8; // Max 80% opacity

        return {
            opacity: direction ? opacity : 0,
        };
    });

    // Animated style for indicator text
    const animatedIndicatorTextStyle = useAnimatedStyle(() => {
        const progress = swipeProgress.value;
        return {
            opacity: progress,
        };
    });

    // Track touches using simple touch handlers on parent container
    const handleTouchStart = (evt: any) => {
        touchStartRef.current = { x: evt.nativeEvent.pageX, y: evt.nativeEvent.pageY };
        swipeProgress.value = 0;
        swipeDirectionValue.value = null;
        setSwipeDirection(null);
    };

    const handleTouchMove = (evt: any) => {
        if (!touchStartRef.current) return;

        const currentX = evt.nativeEvent.pageX;
        const currentY = evt.nativeEvent.pageY;
        const dx = currentX - touchStartRef.current.x;
        const dy = currentY - touchStartRef.current.y;
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);

        const threshold = 30; // Minimum distance to show indicator
        const maxDistance = screenWidth * 0.3; // Maximum distance for full opacity (30% of screen width)

        // Calculate progress based on distance (0 to 1)
        let progress = 0;
        let direction: 'left' | 'right' | 'down' | 'up' | null = null;

        if (absX > absY) {
            // Horizontal swipe
            progress = Math.min(absX / maxDistance, 1);
            if (dx > threshold) {
                direction = 'right';
            } else if (dx < -threshold) {
                direction = 'left';
            }
        } else {
            // Vertical swipe
            progress = Math.min(absY / maxDistance, 1);
            if (dy > threshold) {
                direction = 'down';
            } else if (dy < -threshold) {
                direction = 'up';
            }
        }

        // Update shared values (runs on UI thread, no re-render)
        swipeProgress.value = progress;
        swipeDirectionValue.value = direction;

        // Only update React state when crossing threshold (for conditional rendering)
        if (absX < threshold && absY < threshold) {
            if (swipeDirection !== null) {
                setSwipeDirection(null);
            }
        } else if (direction && swipeDirection !== direction) {
            setSwipeDirection(direction);
        }
    };

    const handleTouchEnd = () => {
        touchStartRef.current = null;
        swipeProgress.value = withTiming(0, { duration: 100 });
        swipeDirectionValue.value = null;
        setTimeout(() => {
            setSwipeDirection(null);
        }, 100);
    };

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

    const handleSkip = async (task: Task): Promise<void> => {
        // Skip - do nothing, just remove from UI
        // No API call needed
    };

    const handleComplete = async (task: Task): Promise<void> => {
        if (!task.categoryID) {
            throw new Error("Task category ID is missing");
        }

        const completeData = {
            timeCompleted: new Date().toISOString(),
            timeTaken: "PT0S", // ISO 8601 duration: 0 seconds
        };

        const res = await markAsCompletedAPI(task.categoryID, task.id, completeData);
        hapticCompletionBurst();
        queryClient.invalidateQueries({ queryKey: ["rings", "today"] });

        // If backend returned the next flex instance, insert it immediately
        if (res.nextFlexTask) {
            addToCategory(res.nextFlexTask.categoryId, {
                ...res.nextFlexTask.task,
                categoryID: res.nextFlexTask.categoryId,
            } as Task);
        }

        // Debounced refresh tasks after completion
        debouncedFetchWorkspaces();
    };

    const handleDelete = async (task: Task): Promise<void> => {
        if (!task.categoryID) {
            throw new Error("Task category ID is missing");
        }
        deleteWithUndo(task, task.categoryID);
    };

    const handleMarkInProgress = async (task: Task): Promise<void> => {
        if (!task.categoryID) {
            throw new Error("Task category ID is missing");
        }
        // Optimistic: durable in-progress flag.
        updateTask(task.categoryID, task.id, { active: true });
        await markInProgressAPI(task.categoryID, task.id);
        hapticLight();
    };

    const resetAnimationAndProcessing = (taskId: string) => {
        fadeOpacity.value = withTiming(1, { duration: 300 });
        setProcessingTasks((prev) => {
            const next = new Set(prev);
            next.delete(taskId);
            return next;
        });
    };

    const removeTaskFromUI = (taskId: string) => {
        setTimeout(() => {
            setRemovedTasks((prev) => {
                if (prev.includes(taskId)) {
                    return prev; // Already removed, don't add again
                }
                return [...prev, taskId];
            });
            setProcessingTasks((prev) => {
                const next = new Set(prev);
                next.delete(taskId);
                return next;
            });
        }, 300);
    };

    const onSwipe = async (direction: string, task: Task) => {
        console.log('You swiped: ' + direction);
        if (!task) return;

        // Prevent duplicate processing
        if (processingTasks.has(task.id)) {
            return;
        }

        // Start fade out animation immediately
        fadeOpacity.value = withTiming(0, {
            duration: 300,
            easing: Easing.out(Easing.ease),
        });

        setProcessingTasks((prev) => new Set(prev).add(task.id));

        try {
            switch (direction) {
                case 'left':
                    await handleSkip(task);
                    break;
                case 'right':
                    await handleComplete(task);
                    break;
                case 'down':
                    await handleDelete(task);
                    break;
                case 'up':
                    await handleMarkInProgress(task);
                    break;
                default:
                    console.warn(`Unknown swipe direction: ${direction}`);
                    resetAnimationAndProcessing(task.id);
                    return;
            }

            // Remove task from UI after successful operation (or skip)
            removeTaskFromUI(task.id);
        } catch (error) {
            console.error(`Failed to handle swipe ${direction}:`, error);

            const actionName = direction === 'right' ? 'complete' : direction === 'down' ? 'delete' : direction === 'up' ? 'mark in progress for' : 'skip';
            const errorMessage = error instanceof Error ? error.message : `Failed to ${actionName} task. Please try again.`;

            Alert.alert("Error", errorMessage);

            // Reset animation on error
            resetAnimationAndProcessing(task.id);
        }
    };

    const outOfFrame = (index: number, id: string) => {
        console.log(index + " left the screen!");
        // Card has left the screen, the cards array has been filtered
        // The next card is now at index 0, and currentTask will update automatically via useMemo
    };

    const windowHeight = Dimensions.get("window").height;
    const windowWidth = Dimensions.get("window").width;
    const cardHeight = windowHeight * 0.44;

    // Buttons drive the same TinderCard fling + pipeline as a physical swipe.
    const triggerSwipe = (direction: "left" | "right" | "down" | "up") => {
        childRefs.current[0]?.swipe(direction);
    };

    return (
        <ThemedView style={{ flex: 1 }}>
            <GlowBackground blobs={REVIEW_GLOW} />
            <View style={[styles.container, { flex: 1 }]}>
                {/* Back button + count */}
                <View style={styles.topRow}>
                    <TouchableOpacity onPress={() => router.back()}>
                        <Ionicons name="chevron-back" size={24} color={ThemedColor.text} />
                    </TouchableOpacity>
                    {!emptyStack && currentTask != null && (
                        <ThemedText style={[styles.hintCount, { color: ThemedColor.primary}]}>
                            {cards.length} left
                        </ThemedText>
                    )}
                </View>

                {/* Card area */}
                <ConditionalView condition={!emptyStack && currentTask != null} style={styles.cardArea}>
                    <View
                        style={{ position: "relative", width: "100%", height: cardHeight }}
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                    >
                        <ReviewTaskCard
                            task={currentTask!}
                            animatedCardStyle={animatedCardStyle}
                            animatedIndicatorStyle={animatedIndicatorStyle}
                            animatedIndicatorTextStyle={animatedIndicatorTextStyle}
                            swipeDirection={swipeDirection}
                            onSwipe={(direction) => {
                                setSwipeDirection(null);
                                onSwipe(direction, currentTask!);
                            }}
                            onCardLeftScreen={() => {
                                setSwipeDirection(null);
                                outOfFrame(0, currentTask?.id || "");
                            }}
                            cardRef={(el) => {
                                if (el) childRefs.current[0] = el;
                            }}
                        />
                    </View>

                    <ReviewCardStack upNext={cards.slice(1, 3)} />

                    <ReviewActions
                        onSkip={() => triggerSwipe("left")}
                        onDelete={() => triggerSwipe("down")}
                        onInProgress={() => triggerSwipe("up")}
                        onDone={() => triggerSwipe("right")}
                        ThemedColor={ThemedColor}
                    />
                </ConditionalView>

                {/* Empty states */}
                <ConditionalView condition={emptyStack && unnestedTasks.length > 0} style={styles.emptyState}>
                    <ThemedText type="title" style={{ textAlign: "center", marginBottom: 8 }}>🎉 All Done!</ThemedText>
                    <ThemedText type="default" style={{ textAlign: "center", color: ThemedColor.caption }}>
                        You've reviewed all {unnestedTasks.length} tasks.
                    </ThemedText>
                </ConditionalView>

                <ConditionalView condition={unnestedTasks.length === 0} style={styles.emptyState}>
                    <ThemedText type="title" style={{ textAlign: "center", marginBottom: 8 }}>No Tasks</ThemedText>
                    <ThemedText type="default" style={{ textAlign: "center", color: ThemedColor.caption }}>
                        Create some tasks to get started!
                    </ThemedText>
                </ConditionalView>

                {/* Bottom button */}
                {/* <View style={styles.generateButtonContainer}>
                    <PrimaryButton
                        title={emptyStack ? "Return" : "Mark All as Completed"}
                        onPress={() => router.back()}
                        outline
                    />
                </View> */}
            </View>
            {alertElement}
        </ThemedView>
    );
};

export default Review;

const styles = StyleSheet.create({
    container: {
        paddingTop: Dimensions.get("screen").height * 0.07,
        paddingHorizontal: HORIZONTAL_PADDING,
    },
    topRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12,
    },
    cardArea: {
        flex: 1,
        alignItems: "center",
    },
    actionsRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "center",
        gap: 28,
        marginTop: 24,
    },
    actionItem: {
        alignItems: "center",
        gap: 6,
    },
    actionButton: {
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 999,
    },
    actionMedium: {
        width: 56,
        height: 56,
        borderWidth: 1.5,
    },
    actionSmall: {
        width: 48,
        height: 48,
        borderWidth: 1.5,
        marginTop: 4,
    },
    actionLarge: {
        width: 64,
        height: 64,
    },
    hintCount: {
        fontSize: 15,
        fontWeight: "600",
    },
    emptyState: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 32,
    },
    generateButtonContainer: {
        paddingVertical: 16,
        width: "100%",
    },
});

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
import { markAsCompletedAPI, removeFromCategoryAPI } from "@/api/task";
import { useDebounce } from "@/hooks/useDebounce";
import ReviewSkeletonCard from "@/components/cards/ReviewSkeletonCard";
import ReviewTaskCard from "@/components/cards/ReviewTaskCard";
type Props = {};

const Review = (props: Props) => {
    const ThemedColor = useThemeColor();
    const router = useRouter();
    const { fetchWorkspaces, unnestedTasks } = useTasks();
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
    const swipeDirectionValue = useSharedValue<'left' | 'right' | 'down' | null>(null);
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
        let direction: 'left' | 'right' | 'down' | null = null;
        
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

        await markAsCompletedAPI(task.categoryID, task.id, completeData);
        
        // Debounced refresh tasks after completion
        debouncedFetchWorkspaces();
    };

    const handleDelete = async (task: Task): Promise<void> => {
        if (!task.categoryID) {
            throw new Error("Task category ID is missing");
        }

        await removeFromCategoryAPI(task.categoryID, task.id, false);
        
        // Debounced refresh tasks after deletion
        debouncedFetchWorkspaces();
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
                default:
                    console.warn(`Unknown swipe direction: ${direction}`);
                    resetAnimationAndProcessing(task.id);
                    return;
            }

            // Remove task from UI after successful operation (or skip)
            removeTaskFromUI(task.id);
        } catch (error) {
            console.error(`Failed to handle swipe ${direction}:`, error);
            
            const actionName = direction === 'right' ? 'complete' : direction === 'down' ? 'delete' : 'skip';
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
                        Swipe right to complete • Swipe down to delete • Swipe left to skip
                    </ThemedText>
                </View>

                <ConditionalView condition={!emptyStack && currentTask != null} style={styles.taskContainer}>
                    <View 
                        style={{ position: "relative", width: "100%", height: Dimensions.get("window").width * 1 }}
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                    >
                        <ReviewSkeletonCard />
                        
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
                                if (el) {
                                    childRefs.current[0] = el;
                                }
                            }}
                        />
                    </View>
                <View style={{paddingVertical: 8, marginTop: 12, justifyContent: "center", width:'100%'}}>
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
});


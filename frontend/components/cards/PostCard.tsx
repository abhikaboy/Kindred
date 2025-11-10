import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import {
    Modal,
    TouchableOpacity,
    View,
    StyleSheet,
    Dimensions,
    Platform,
    KeyboardAvoidingView,
    Image as RNImage,
    Alert,
} from "react-native";
import { Image } from "expo-image";
import CachedImage from "../CachedImage";
import { ThemedText } from "../ThemedText";
import UserInfoRowTimed from "../UserInfo/UserInfoRowTimed";
import ReactPills from "../inputs/ReactPills";
import ReactionAction from "../inputs/ReactionAction";
import Carousel from "react-native-reanimated-carousel";
import { Directions, GestureDetector, Gesture } from "react-native-gesture-handler";
import Comment, { CommentProps } from "../inputs/Comment";
import { useThemeColor } from "@/hooks/useThemeColor";
import { BottomSheetBackdrop, BottomSheetModal } from "@gorhom/bottom-sheet";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import Svg, { Path } from "react-native-svg";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import CongratulateModal from "../modals/CongratulateModal";
import { useAuth } from "@/hooks/useAuth";
import { toggleReaction, updatePost, deletePost } from "@/api/post";
import { useQueryClient } from '@tanstack/react-query';
import { useTasks } from "@/contexts/tasksContext";
import type { components } from "@/api/generated/types";
import Ionicons from '@expo/vector-icons/Ionicons';
import { showToast } from "@/utils/showToast";
import * as Clipboard from 'expo-clipboard';
import * as SMS from 'expo-sms';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, withSpring } from 'react-native-reanimated';
import { Confetti } from "phosphor-react-native";

type ImageSize = components["schemas"]["ImageSize"];

/* 
 * PINCH-TO-ZOOM FEATURE - CURRENTLY DISABLED
 * To re-enable: uncomment this component and update the usage below
 * 
// PinchableImage component for Instagram-like pinch-to-zoom
const PinchableImage = ({ source, style, onLongPress }: { source: any; style: any; onLongPress: () => void }) => {
    const scale = useSharedValue(1);
    const savedScale = useSharedValue(1);
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const savedTranslateX = useSharedValue(0);
    const savedTranslateY = useSharedValue(0);
    const focalX = useSharedValue(0);
    const focalY = useSharedValue(0);
    
    // Memoize screen dimensions to prevent repeated calls
    const screenWidth = useMemo(() => Dimensions.get('window').width, []);

    const pinchGesture = Gesture.Pinch()
        .onStart((e) => {
            'worklet';
            try {
                savedScale.value = scale.value;
                savedTranslateX.value = translateX.value;
                savedTranslateY.value = translateY.value;
                // Store focal point with safety checks
                focalX.value = e.focalX ?? 0;
                focalY.value = e.focalY ?? 0;
            } catch (error) {
                // Fail silently to prevent crashes
                console.log('Pinch gesture start error:', error);
            }
        })
        .onUpdate((e) => {
            'worklet';
            try {
                // Clamp scale between 0.5 and 4 to prevent extreme values
                const newScale = Math.max(0.5, Math.min(4, savedScale.value * e.scale));
                scale.value = newScale;
                
                // Calculate translation to zoom into focal point
                const deltaScale = newScale - savedScale.value;
                const centerX = screenWidth / 2;
                const centerY = screenWidth / 2;
                
                // Add bounds checking to prevent NaN values
                const focalXValue = isFinite(focalX.value) ? focalX.value : centerX;
                const focalYValue = isFinite(focalY.value) ? focalY.value : centerY;
                
                const newTranslateX = savedTranslateX.value + (centerX - focalXValue) * deltaScale;
                const newTranslateY = savedTranslateY.value + (centerY - focalYValue) * deltaScale;
                
                // Only update if values are finite
                if (isFinite(newTranslateX)) translateX.value = newTranslateX;
                if (isFinite(newTranslateY)) translateY.value = newTranslateY;
            } catch (error) {
                // Fail silently to prevent crashes
                console.log('Pinch gesture update error:', error);
            }
        })
        .onEnd(() => {
            'worklet';
            try {
                // Always reset to normal when pinch ends
                scale.value = withSpring(1, { damping: 15, stiffness: 150 });
                translateX.value = withSpring(0, { damping: 15, stiffness: 150 });
                translateY.value = withSpring(0, { damping: 15, stiffness: 150 });
                savedScale.value = 1;
                savedTranslateX.value = 0;
                savedTranslateY.value = 0;
            } catch (error) {
                // Fail silently to prevent crashes
                console.log('Pinch gesture end error:', error);
            }
        });

    const panGesture = Gesture.Pan()
        .maxPointers(1)
        .onStart(() => {
            'worklet';
            try {
                savedTranslateX.value = translateX.value;
                savedTranslateY.value = translateY.value;
            } catch (error) {
                console.log('Pan gesture start error:', error);
            }
        })
        .onUpdate((e) => {
            'worklet';
            try {
                // Only allow panning when zoomed in
                if (scale.value > 1.1) {
                    const newTranslateX = savedTranslateX.value + (e.translationX ?? 0);
                    const newTranslateY = savedTranslateY.value + (e.translationY ?? 0);
                    
                    // Add reasonable bounds to prevent excessive panning
                    const maxTranslate = screenWidth * scale.value;
                    translateX.value = Math.max(-maxTranslate, Math.min(maxTranslate, newTranslateX));
                    translateY.value = Math.max(-maxTranslate, Math.min(maxTranslate, newTranslateY));
                }
            } catch (error) {
                console.log('Pan gesture update error:', error);
            }
        })
        .onEnd(() => {
            'worklet';
            try {
                savedTranslateX.value = translateX.value;
                savedTranslateY.value = translateY.value;
            } catch (error) {
                console.log('Pan gesture end error:', error);
            }
        });

    // Combine pinch and pan gestures
    const composed = Gesture.Simultaneous(pinchGesture, panGesture);

    const animatedStyle = useAnimatedStyle(() => {
        'worklet';
        try {
            return {
                transform: [
                    { translateX: isFinite(translateX.value) ? translateX.value : 0 },
                    { translateY: isFinite(translateY.value) ? translateY.value : 0 },
                    { scale: isFinite(scale.value) ? scale.value : 1 },
                ] as any,
            };
        } catch (error) {
            // Return default transform if error occurs
            return {
                transform: [
                    { translateX: 0 },
                    { translateY: 0 },
                    { scale: 1 },
                ] as any,
            };
        }
    });

    return (
        <GestureDetector gesture={composed}>
            <Animated.View style={[{ width: '100%', height: '100%' }, animatedStyle]}>
                <TouchableOpacity 
                    onLongPress={onLongPress}
                    activeOpacity={1}
                    style={{ width: '100%', height: '100%' }}
                    delayLongPress={500}
                >
                    <CachedImage 
                        source={source}
                        style={style}
                        variant="large"
                        useLocalPlaceholder
                        cachePolicy="memory-disk"
                    />
                </TouchableOpacity>
            </Animated.View>
        </GestureDetector>
    );
};
*/

// Simple image component without pinch-to-zoom (current active version)
const SimpleImage = ({ source, style, onLongPress }: { source: any; style: any; onLongPress: () => void }) => {
    return (
        <TouchableOpacity 
            onLongPress={onLongPress}
            activeOpacity={1}
            style={{ width: '100%', height: '100%' }}
            delayLongPress={500}
        >
            <CachedImage 
                source={source}
                style={style}
                variant="large"
                useLocalPlaceholder
                cachePolicy="memory-disk"
            />
        </TouchableOpacity>
    );
};


export type SlackReaction = {
    emoji: string;
    count: number;
    ids: string[];
};

type Props = {
    icon: string;
    name: string;
    username: string;
    userId: string;
    caption: string;
    time: number;
    priority?: string;
    points?: number;
    timeTaken?: number;
    reactions?: SlackReaction[];
    images?: string[];
    id?: string;
    comments?: CommentProps[];
    category?: string;
    taskName?: string;
    size?: ImageSize;
    onReactionUpdate?: () => void;
    onHeightChange?: (height: number) => void;
};

const PostCard = React.memo(({
    icon,
    name,
    username,
    userId,
    caption,
    time,
    priority,
    points,
    timeTaken,
    reactions = [],
    images,
    comments,
    category,
    taskName,
    id,
    size,
    onHeightChange,
}: Props) => {
    const [modalVisible, setModalVisible] = useState(false);
    const [newReactions, setNewReactions] = useState<SlackReaction[]>([]);
    const [modalIndex, setModalIndex] = useState(0);
    const [congratulateModalVisible, setCongratulateModalVisible] = useState(false);
    const [currentComments, setCurrentComments] = useState(comments || []);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [localReactions, setLocalReactions] = useState<SlackReaction[]>(reactions);
    const [imageHeight, setImageHeight] = useState<number>(512);
    const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
    const queryClient = useQueryClient();
    const screenWidth = useMemo(() => Dimensions.get("window").width, []);
    const { fetchWorkspaces } = useTasks();

    // Memoize stringified reactions to avoid expensive JSON operations on every render
    const reactionsStringified = useMemo(() => JSON.stringify(reactions), [reactions]);
    const localReactionsStringified = useMemo(() => JSON.stringify(localReactions), [localReactions]);
    
    // Memoize size values to prevent unnecessary recalculations
    const memoizedSize = useMemo(() => size, [size?.width, size?.height, size?.bytes]);
    
    // Memoize images array to prevent unnecessary recalculations
    const memoizedImages = useMemo(() => images, [images?.join(',')]);
    
    // Memoize the first image URL for calculations
    const firstImageUrl = useMemo(() => memoizedImages?.[0], [memoizedImages]);
    
    useEffect(() => {
        // Only update localReactions if the reactions prop has genuinely changed
        // and we don't have pending local changes that would be overwritten
        if (reactionsStringified !== localReactionsStringified) {
            // Check if we have any local changes that haven't been persisted yet
            const hasLocalChanges = localReactions.some(localReaction => {
                const propReaction = reactions.find(r => r.emoji === localReaction.emoji);
                if (!propReaction) {
                    // Local reaction exists but not in props - this is a local addition
                    return true;
                }
                // Check if counts differ - this could be a local change
                return propReaction.count !== localReaction.count;
            });
            
            // Only update if there are no local changes, or if this is the initial load
            if (!hasLocalChanges || localReactions.length === 0) {
                setLocalReactions(reactions);
            }
        }
    }, [reactions]);

    useEffect(() => {
        setCurrentComments(comments || []);
    }, [comments]);

    // Calculate image height when images or size data changes
    useEffect(() => {
        if (memoizedImages && memoizedImages.length > 0) {
            // Check if we have valid size information
            if (memoizedSize && memoizedSize.width > 0 && memoizedSize.height > 0) {
                // Use the provided size information to calculate height
                const aspectRatio = memoizedSize.width / memoizedSize.height;
                const calculatedHeight = screenWidth / aspectRatio;
                
                // Constrain height between 0.5x and 1.5x screen width
                const minHeight = screenWidth * 0.5;
                const maxHeight = screenWidth * 1.5;
                const constrainedHeight = Math.max(minHeight, Math.min(calculatedHeight, maxHeight));
                
                setImageHeight(constrainedHeight);
                onHeightChange?.(constrainedHeight);
            } else {
                // Fallback to blocking image size calculation only when size data is missing/invalid
                console.log('No valid size data available, falling back to image size calculation for post:', id);
                const timeoutId = setTimeout(() => {
                    calculateImageHeight(firstImageUrl);
                }, 0);
                return () => clearTimeout(timeoutId);
            }
        } else {
            setImageHeight(512);
            onHeightChange?.(512);
        }
    }, [memoizedImages, memoizedSize, screenWidth, firstImageUrl]);

    const calculateImageHeight = useCallback((imageUri: string) => {
        RNImage.getSize(imageUri, async (width, height) => {
            const aspectRatio = width / height;
            const calculatedHeight = screenWidth / aspectRatio;
            
            // Constrain height between 0.5x and 1.5x screen width
            const minHeight = screenWidth * 0.5;
            const maxHeight = screenWidth * 1.5;
            const constrainedHeight = Math.max(minHeight, Math.min(calculatedHeight, maxHeight));
            
            setImageHeight(constrainedHeight);
            onHeightChange?.(constrainedHeight);
            
            // Update the post with the computed size information for future requests
            if (id && width > 0 && height > 0) {
                try {
                    // Estimate file size (this is approximate since we don't have the actual file)
                    // Using a rough estimate based on image dimensions
                    const estimatedBytes = Math.round(width * height * 0.5); // Rough estimate for compressed image
                    
                    await updatePost(id, undefined, undefined, {
                        width,
                        height,
                        bytes: estimatedBytes
                    });
                    
                    console.log(`Updated post ${id} with size information: ${width}x${height}`);
                } catch (error) {
                    console.error('Failed to update post with size information:', error);
                    // Don't throw - this is a background optimization, not critical
                }
            }
        }, (error) => {
            console.error('Error getting image size:', error);
            // Fallback to default height
            const fallbackHeight = screenWidth * 0.75;
            setImageHeight(fallbackHeight);
            onHeightChange?.(fallbackHeight);
        });
    }, [screenWidth, onHeightChange, id]);

    const screenHeight = Dimensions.get("window").height;

    // Define snap points
    const snapPoints = useMemo(() => {
        // const baseHeight = screenHeight * 0.1; // 70% of screen
        // return [baseHeight];
    }, [screenHeight]);

    const mergeReactions = (): SlackReaction[] => {
        const safeReactions = Array.isArray(reactions) ? reactions : [];
        const reactionMap = new Map<string, SlackReaction>();

        safeReactions.forEach((reaction) => {
            reactionMap.set(reaction.emoji, { ...reaction });
        });

        newReactions.forEach((newReaction) => {
            const existing = reactionMap.get(newReaction.emoji);
            if (existing) {
                const combinedIds = [...new Set([...existing.ids, ...newReaction.ids])];
                reactionMap.set(newReaction.emoji, {
                    emoji: newReaction.emoji,
                    count: combinedIds.length,
                    ids: combinedIds,
                });
            } else {
                reactionMap.set(newReaction.emoji, { ...newReaction });
            }
        });
        return Array.from(reactionMap.values()).filter((reaction) => reaction.count > 0);
    };

    const allReactions = mergeReactions();

    const ThemedColor = useThemeColor();
    const { user } = useAuth();
    const handleClose = () => {
        bottomSheetModalRef.current?.dismiss();
    };

    const renderBackdrop = useCallback(
        (props) => (
            <BottomSheetBackdrop
                {...props}
                disappearsOnIndex={-1}
                appearsOnIndex={0}
                opacity={0.5}
                enableTouchThrough={false}
                pressBehavior="close"
            />
        ),
        []
    );

    const bottomSheetModalRef = useRef<BottomSheetModal>(null);

    const handleOpenComments = useCallback(() => {
        bottomSheetModalRef.current?.present();
        console.log("handleOpenComments");
    }, []);

    const handleSheetChanges = useCallback((index: number) => {
        console.log("handleSheetChanges", index);
        setIsBottomSheetOpen(index !== -1);
    }, []);

    const handleCommentAdded = (newComment: any) => {
        setCurrentComments((prevComments) => [...(prevComments || []), newComment]);
    };

    const hasUserReacted = (emoji: string): boolean => {
        const reaction = localReactions.find((r) => r.emoji === emoji);
        return reaction ? reaction.ids.includes(user?._id || "") : false;
    };

    const handleReaction = async (emoji: string) => {
        if (!user?._id || !id) {
            return;
        }

        if (Platform.OS === "ios") {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }

        try {
            const response = await toggleReaction(id, emoji);
            const wasAdded = response.added;

            setLocalReactions((prevReactions) => {
                const reactionIndex = prevReactions.findIndex((r) => r.emoji === emoji);

                if (reactionIndex >= 0) {
                    const existingReaction = prevReactions[reactionIndex];
                    const userIds = new Set(existingReaction.ids);

                    if (wasAdded) {
                        userIds.add(user._id);
                    } else {
                        userIds.delete(user._id);
                    }

                    const updatedReaction = {
                        emoji,
                        count: userIds.size,
                        ids: Array.from(userIds),
                    };

                    if (updatedReaction.count === 0) {
                        return prevReactions.filter((_, index) => index !== reactionIndex);
                    } else {
                        return prevReactions.map((reaction, index) =>
                            index === reactionIndex ? updatedReaction : reaction
                        );
                    }
                } else {
                    if (wasAdded) {
                        return [
                            ...prevReactions,
                            {
                                emoji,
                                count: 1,
                                ids: [user._id],
                            },
                        ];
                    }
                    return prevReactions;
                }
            });
        } catch (error) {
            console.error("Failed to toggle reaction:", error);
        }
    };
    const openModal = (imageIndex) => {
        setModalVisible(true);
        setModalIndex(imageIndex);
    };

    const formatTime = (timeInHours: number) => {
        if (timeInHours < 1) {
            return `${Math.round(timeInHours * 60)}m ago`;
        } else if (timeInHours < 24) {
            return `${Math.round(timeInHours)}h ago`;
        } else {
            return `${Math.round(timeInHours / 24)}d ago`;
        }
    };

    const handleCongratulatePress = async () => {
        if (!user?._id) {
            // User is not authenticated, could show a login prompt here
            console.log("User not authenticated");
            return;
        }

        if (user._id === userId) {
            // User is trying to congratulate themselves
            console.log("Cannot congratulate yourself");
            return;
        }

        try {
            if (Platform.OS === "ios") {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
        } catch (error) {
            console.log("Haptic error:", error);
        }
        setCongratulateModalVisible(true);
    };

    const handleCopyLink = async () => {
        if (!id) return;
        
        try {
            const postLink = `kindred://posting/${id}`;
            await Clipboard.setStringAsync(postLink);
            showToast('Link copied to clipboard!', 'success');
        } catch (error) {
            console.error('Error copying link:', error);
            showToast('Failed to copy link', 'danger');
        }
    };

    const handleSharePost = async () => {
        if (!id) return;
        
        try {
            await SMS.sendSMSAsync(
                [], 
                `Check out this post on Kindred! kindred://posting/${id}`
            );
        } catch (error) {
            console.error('Error sharing post:', error);
            showToast('Failed to share post', 'danger');
        }
    };

    const showPostOptions = () => {
        if (!id) {
            return;
        }

        const isOwnPost = user?._id === userId;
        
        const options = [];

        options.push({
            text: "View Post",
            onPress: () => router.push(`/(logged-in)/posting/${id}`),
        });

        options.push({
            text: "Copy Link",
            onPress: handleCopyLink,
        });

        options.push({
            text: "Share",
            onPress: handleSharePost,
        });

        if (isOwnPost) {
            options.push({
                text: "Delete Post",
                style: "destructive" as const,
                onPress: () => showDeleteConfirmation(),
            });
        } else {
            options.push({
                text: "Report Post",
                style: "destructive" as const,
                onPress: () => handleReportPost(),
            });
        }

        options.push({
            text: "Cancel",
            style: "cancel" as const,
        });

        Alert.alert("Post Options", "", options);
    };

    const showDeleteConfirmation = () => {
        Alert.alert(
            "Delete Post",
            "Are you sure you want to delete this post? This action cannot be undone.",
            [
                {
                    text: "Cancel",
                    style: "cancel",
                },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: handleDeletePost,
                },
            ]
        );
    };

    const handleDeletePost = async () => {
        if (!id) {
            return;
        }

        try {
            await deletePost(id);
            showToast("Post deleted successfully", "success");
            
            // Invalidate queries to refresh the feed
            queryClient.invalidateQueries({ queryKey: ['posts'] });
            queryClient.invalidateQueries({ queryKey: ['friendsPosts'] });
            queryClient.invalidateQueries({ queryKey: ['userPosts', userId] });
            
        } catch (error) {
            console.error("Error deleting post:", error);
            showToast("Failed to delete post", "danger");
        }
    };

    const handleReportPost = () => {
        Alert.alert(
            "Report Post",
            "Why are you reporting this post?",
            [
                {
                    text: "Inappropriate content",
                    onPress: () => submitReport("inappropriate"),
                },
                {
                    text: "Spam",
                    onPress: () => submitReport("spam"),
                },
                {
                    text: "Harassment",
                    onPress: () => submitReport("harassment"),
                },
                {
                    text: "Other",
                    onPress: () => submitReport("other"),
                },
                {
                    text: "Cancel",
                    style: "cancel",
                },
            ]
        );
    };

    const submitReport = async (reason: string) => {
        // TODO: Implement report submission to backend
        console.log(`Reporting post ${id} for: ${reason}`);
        showToast("Report submitted. Thank you for helping keep Kindred safe.", "info");
    };

    const styles = stylesheet(ThemedColor);

    return (
        <View style={[styles.container, { backgroundColor: ThemedColor.background }]}>
            <View style={styles.content}>
                    <View style={styles.header}>
                        <TouchableOpacity
                            style={styles.userInfo}
                            activeOpacity={0.4}
                            onPress={async () => {
                                try {
                                    if (Platform.OS === "ios") {
                                        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    }
                                } catch (error) {
                                    console.log("Haptic error:", error);
                                }
                                console.log("Navigating to user:", userId);
                                router.push(`/account/${userId}`);
                            }}>
                            <CachedImage source={{ uri: icon }} style={styles.userIcon} variant="thumbnail" cachePolicy="memory-disk" />
                            <View style={styles.userDetails}>
                                <ThemedText type="default" style={styles.userName}>
                                    {name}
                                </ThemedText>
                                <ThemedText type="caption" style={styles.username}>
                                    {username}
                                </ThemedText>
                            </View>
                        </TouchableOpacity>
                        <View style={styles.timeAndMenu}>
                            <TouchableOpacity
                                onPress={showPostOptions}
                                style={styles.menuButton}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Ionicons 
                                    name="ellipsis-horizontal" 
                                    size={20} 
                                    color={ThemedColor.caption} 
                                />
                            </TouchableOpacity>
                            <ThemedText type="caption" style={styles.timeText}>
                                {formatTime(time)}
                            </ThemedText>
                        </View>
                    </View>
                    {memoizedImages && memoizedImages.length > 0 && (
                        <View style={styles.imageContainer}>
                            {memoizedImages.length === 1 ? (
                                // Single image - no counter needed
                                <View style={{ width: Dimensions.get("window").width, height: imageHeight }}>
                                    <SimpleImage
                                        source={{ uri: memoizedImages[0] }}
                                        style={[styles.image, { height: imageHeight }]}
                                        onLongPress={() => openModal(0)}
                                    />
                                </View>
                            ) : (
                                <View style={styles.carouselContainer}>
                                    <Carousel
                                        loop={false}
                                        vertical={false}
                                        width={Dimensions.get("window").width}
                                        height={imageHeight}
                                        style={styles.carousel}
                                        data={memoizedImages}
                                        onSnapToItem={(index) => setCurrentImageIndex(index)}
                                        scrollAnimationDuration={300}
                                        enabled={memoizedImages.length > 1}
                                        windowSize={2}
                                        onConfigurePanGesture={(panGesture) => {
                                            panGesture.activeOffsetX([-10, 10]).failOffsetY([-30, 30]).maxPointers(1);
                                        }}
                                        renderItem={({ item, index }) => (
                                            <View style={{ width: Dimensions.get("window").width, height: imageHeight }}>
                                                <SimpleImage
                                                    source={{ uri: item }}
                                                    style={[styles.image, { height: imageHeight }]}
                                                    onLongPress={() => openModal(index)}
                                                />
                                            </View>
                                        )}
                                    />

                                    <View style={styles.imageCounter}>
                                        <View style={styles.imageCounterBackground}>
                                            <ThemedText style={styles.imageCounterText}>
                                                {currentImageIndex + 1}/{memoizedImages.length}
                                            </ThemedText>
                                        </View>
                                    </View>

                                    <View style={styles.dotIndicators}>
                                        {memoizedImages.map((_, index) => (
                                            <View
                                                key={index}
                                                style={[
                                                    styles.dot,
                                                    {
                                                        backgroundColor:
                                                            index === currentImageIndex
                                                                ? ThemedColor.primary
                                                                : ThemedColor.tertiary,
                                                    },
                                                ]}
                                            />
                                        ))}
                                    </View>
                                </View>
                            )}
                        </View>
                    )}
                    {/* Category and task section */}
                    {(category || taskName) && (
                        <View style={styles.categorySection}>
                            <View style={styles.categoryRow}>
                                {category && (
                                    <>
                                        <ThemedText style={[styles.categoryText, { color: ThemedColor.primary }]}>
                                            {category}
                                        </ThemedText>
                                        <View style={[styles.dot, { backgroundColor: ThemedColor.primary }]} />
                                    </>
                                )}
                                {taskName && (
                                    <ThemedText style={[styles.categoryText, { color: ThemedColor.text }]}>
                                        {taskName}
                                    </ThemedText>
                                )}
                            </View>
                            <TouchableOpacity
                                style={[
                                    styles.congratulateButton,
                                    (!user?._id || user?._id === userId) && { opacity: 0.5 },
                                ]}
                                onPress={handleCongratulatePress}
                                disabled={!user?._id || user?._id === userId}>
                                <Confetti size={24} weight="regular" color={ThemedColor.primary} />
                                <ThemedText style={[styles.congratulateText, { color: ThemedColor.primary }]}>
                                    {!user?._id
                                        ? "Login to Congratulate"
                                        : user?._id === userId
                                          ? "Your Post"
                                          : "Congratulate"}
                                </ThemedText>
                            </TouchableOpacity>
                        </View>
                    )}
                    {/* Caption and reactions */}
                    <View style={styles.captionSection}>
                        <ThemedText type="default" style={[styles.caption, { color: ThemedColor.text }]}>
                            {caption}
                        </ThemedText>

                        <View style={styles.reactionsRow}>
                            {localReactions.map((react, index) => (
                                <ReactPills
                                    key={`${react.emoji}-${index}`}
                                    reaction={react}
                                    postId={0}
                                    isHighlighted={hasUserReacted(react.emoji)}
                                    onPress={() => handleReaction(react.emoji)}
                                />
                            ))}
                            <ReactionAction onAddReaction={(emoji) => handleReaction(emoji)} postId={0} />
                        </View>

                        <TouchableOpacity onPress={handleOpenComments} style={styles.commentButton}>
                            <ThemedText style={styles.commentText}>
                                💬{" "}
                                <ThemedText style={[styles.commentText, { color: ThemedColor.caption }]}>
                                    {currentComments.length === 0
                                        ? "Leave a comment"
                                        : `View ${currentComments.length} comment${currentComments.length === 1 ? "" : "s"}`}{" "}
                                </ThemedText>
                            </ThemedText>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Image modal */}
                {modalVisible && (
                    <Modal
                        visible={modalVisible}
                        transparent={true}
                        animationType="slide"
                        onRequestClose={() => setModalVisible(false)}>
                        <TouchableOpacity
                            activeOpacity={1}
                            style={styles.modalContainer}
                            onPress={() => setModalVisible(false)}>
                            <View style={styles.modalContent}>
                                <RNImage source={{ uri: memoizedImages[modalIndex] }} style={styles.popupImage} />
                            </View>
                        </TouchableOpacity>
                    </Modal>
                )}

                {/* Comments bottom sheet */}
                <BottomSheetModal
                    ref={bottomSheetModalRef}
                    onChange={handleSheetChanges}
                    snapPoints={["80%"]}
                    index={1}
                    enablePanDownToClose={true}
                    enableDismissOnClose={true}
                    enableHandlePanningGesture={true}
                    keyboardBehavior="interactive"
                    keyboardBlurBehavior="restore"
                    android_keyboardInputMode="adjustResize"
                    handleStyle={{
                        backgroundColor: ThemedColor.background,
                        borderTopLeftRadius: 24,
                        borderTopRightRadius: 24,
                    }}
                    handleIndicatorStyle={{
                        backgroundColor: ThemedColor.text,
                        width: 48,
                        height: 3,
                        borderRadius: 10,
                        marginVertical: 12,
                    }}
                    backgroundStyle={{
                        borderTopLeftRadius: 32,
                        borderTopRightRadius: 32,
                    }}
                    backdropComponent={renderBackdrop}
                    style={{
                        backgroundColor: ThemedColor.background,
                        borderTopLeftRadius: 24,
                        borderTopRightRadius: 24,
                    }}>
                    <Comment
                        comments={currentComments}
                        postId={id}
                        ref={bottomSheetModalRef}
                        onClose={handleClose}
                        onCommentAdded={handleCommentAdded}
                        currentUserId={user?._id}
                        postOwnerId={userId}
                    />
                </BottomSheetModal>

                {/* Congratulate Modal */}
                <CongratulateModal
                    visible={congratulateModalVisible}
                    setVisible={setCongratulateModalVisible}
                    task={{
                        id: "", // We don't have task ID in PostCard props, but it's not required for congratulation
                        content: taskName || caption || "Completed Task",
                        value: points || 0,
                        priority: priority === "high" ? 3 : priority === "medium" ? 2 : 1,
                        categoryId: "",
                    }}
                    congratulationConfig={{
                        userHandle: username,
                        receiverId: userId,
                        categoryName: category || "General",
                    }}
                />
        </View>
    );
});


const stylesheet = (ThemedColor: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            borderBottomWidth: 1.5,
            borderBottomColor: ThemedColor.tertiary,
            paddingVertical: 8,
        },
        content: {
            paddingVertical: 12,
        },
        header: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: HORIZONTAL_PADDING,
            marginBottom: 18,
        },
        userInfo: {
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            flex: 1,
        },
        userIcon: {
            width: 48,
            height: 48,
            borderRadius: 24,
        },
        userDetails: {
            flex: 1,
            gap: 3,
        },
        userName: {
            fontSize: 16,
            fontWeight: "400",
            color: ThemedColor.text,
        },
        username: {
            fontSize: 14,
            fontWeight: "300",
            color: ThemedColor.caption,
        },
        timeAndMenu: {
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
        },
        timeText: {
            fontSize: 12,
            fontWeight: "400",
            color: ThemedColor.caption,
        },
        menuButton: {
            padding: 2,
        },
        categorySection: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: HORIZONTAL_PADDING,
            marginBottom: 18,
        },
        categoryRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            maxWidth: "70%",
            flex: 1,
        },
        categoryText: {
            fontSize: 16,
            fontWeight: "400",
            letterSpacing: -0.16,
        },
        congratulateButton: {
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
        },
        congratulateIcon: {
            fontSize: 24,
        },
        congratulateText: {
            fontSize: 14,
            fontWeight: "400",
            letterSpacing: -0.14,
        },
        captionSection: {
            paddingHorizontal: HORIZONTAL_PADDING,
            gap: 16,
        },
        caption: {
            fontSize: 16,
            fontWeight: "400",
            lineHeight: 20,
        },
        reactionsRow: {
            flexDirection: "row",
            gap: 8,
            flexWrap: "wrap",
        },
        commentButton: {
            paddingTop: 4,
        },
        commentText: {
            fontSize: 14,
            fontWeight: "400",
        },
        modalContainer: {
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "rgba(0,0,0,0.5)",
        },
        modalContent: {
            borderRadius: 10,
            alignItems: "center",
        },
        popupImage: {
            width: Dimensions.get("window").width * 0.9,
            height: Dimensions.get("window").width * 0.9,
            resizeMode: "contain",
        },

        imageContainer: {
            width: "100%",
            marginBottom: 18,
        },
        carouselContainer: {
            position: "relative",
        },
        carousel: {
            width: Dimensions.get("window").width,
            minWidth: Dimensions.get("window").width,
        },
        image: {
            width: Dimensions.get("window").width,
            resizeMode: "cover",
        },
        imageCounter: {
            position: "absolute",
            top: 12,
            right: 12,
            zIndex: 10,
        },
        imageCounterBackground: {
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            borderRadius: 12,
            paddingHorizontal: 8,
            paddingVertical: 4,
        },
        imageCounterText: {
            color: "#ffffff",
            fontSize: 12,
            fontWeight: "600",
            textAlign: "center",
        },

        dotIndicators: {
            position: "absolute",
            bottom: 12,
            left: 0,
            right: 0,
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            gap: 6,
        },
        dot: {
            width: 6,
            height: 6,
            borderRadius: 3,
            opacity: 0.8,
        },
    });
export default PostCard;
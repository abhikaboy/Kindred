import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import {
    Modal,
    TouchableOpacity,
    View,
    StyleSheet,
    Dimensions,
    Platform,
    Image as RNImage,
} from "react-native";
import { ThemedText } from "../ThemedText";
import Comment, { CommentProps } from "../inputs/Comment";
import { useThemeColor } from "@/hooks/useThemeColor";
import { BottomSheetBackdrop, BottomSheetModal } from "@gorhom/bottom-sheet";
import * as Haptics from "expo-haptics";
import CongratulateModal from "../modals/CongratulateModal";
import { useAuth } from "@/hooks/useAuth";
import { toggleReaction, updatePost, deletePost, reportPost } from "@/api/post";
import { blockUser } from "@/api/connection";
import { useAlert } from "@/contexts/AlertContext";
import { useQueryClient } from '@tanstack/react-query';
import { useTasks } from "@/contexts/tasksContext";
import type { components } from "@/api/generated/types";
import { showToast } from "@/utils/showToast";
import * as Clipboard from 'expo-clipboard';
import * as SMS from 'expo-sms';
import PostCardHeader from "./PostCardHeader";
import PostCardMedia from "./PostCardMedia";
import PostCardFooter from "./PostCardFooter";

type ImageSize = components["schemas"]["ImageSize"];


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
    dual?: string;
    id?: string;
    comments?: CommentProps[];
    category?: string;
    taskName?: string;
    size?: ImageSize;
    onReactionUpdate?: () => void;
    onHeightChange?: (height: number) => void;
    onHide?: (postId: string) => void;
    onBlockUser?: (userId: string) => void;
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
    dual,
    comments,
    category,
    taskName,
    id,
    size,
    onHeightChange,
    onHide,
    onBlockUser,
}: Props) => {
    const [modalVisible, setModalVisible] = useState(false);
    const [newReactions, setNewReactions] = useState<SlackReaction[]>([]);
    const [modalIndex, setModalIndex] = useState(0);
    const [congratulateModalVisible, setCongratulateModalVisible] = useState(false);
    const [currentComments, setCurrentComments] = useState(comments || []);
    const [localReactions, setLocalReactions] = useState<SlackReaction[]>(reactions);
    const [imageHeight, setImageHeight] = useState<number>(512);
    const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
    const queryClient = useQueryClient();
    const screenWidth = useMemo(() => Dimensions.get("window").width, []);
    const { fetchWorkspaces } = useTasks();

    // Alert state
    // Use alert queue instead of local state
    const { showAlert } = useAlert();

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

            options.push({
                text: "Block User",
                style: "destructive" as const,
                onPress: () => handleBlockUser(),
            });
        }

        options.push({
            text: "Cancel",
            style: "cancel" as const,
        });

        showAlert({
            title: "Post Options",
            message: "",
            buttons: options,
        });
    };

    const showDeleteConfirmation = () => {
        showAlert({
            title: "Delete Post",
            message: "Are you sure you want to delete this post? This action cannot be undone.",
            buttons: [
                {
                    text: "Cancel",
                    style: "cancel",
                },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: handleDeletePost,
                },
            ],
        });
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
        showAlert({
            title: "Report Post",
            message: "Why are you reporting this post?",
            buttons: [
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
            ],
        });
    };

    const submitReport = async (reason: string) => {
        if (!id) return;

        try {
            await reportPost(id, reason as 'inappropriate' | 'spam' | 'harassment' | 'other');
            showToast("Report submitted. Thank you for helping keep Kindred safe.", "success");
            onHide?.(id);
        } catch (error) {
            console.error(`Failed to report post ${id}:`, error);
            showToast("Failed to submit report. Please try again.", "danger");
        }
    };

    const handleBlockUser = () => {
        showAlert({
            title: "Block User",
            message: `Are you sure you want to block ${name}? You won't see their posts or comments, and they won't be able to see yours.`,
            buttons: [
                {
                    text: "Cancel",
                    style: "cancel",
                },
                {
                    text: "Block",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await blockUser(userId);
                            showToast(`${name} has been blocked`, "success");

                            // Hide this post and remove all posts by the blocked user from feed
                            if (id) onHide?.(id);
                            onBlockUser?.(userId);

                            // Invalidate queries to refresh feed and remove blocked user's content
                            queryClient.invalidateQueries({ queryKey: ['posts'] });
                            queryClient.invalidateQueries({ queryKey: ['friendsPosts'] });
                        } catch (error) {
                            console.error(`Failed to block user ${userId}:`, error);
                            showToast("Failed to block user. Please try again.", "danger");
                        }
                    },
                },
            ],
        });
    };


    const styles = stylesheet(ThemedColor);

    return (
        <View style={[styles.container, { backgroundColor: ThemedColor.background }]}>
            <View style={styles.content}>
                    <PostCardHeader
                        icon={icon}
                        name={name}
                        username={username}
                        userId={userId}
                        timeLabel={formatTime(time)}
                        onOptionsPress={showPostOptions}
                    />
                    {memoizedImages && memoizedImages.length > 0 && (
                        <PostCardMedia
                            images={memoizedImages}
                            dual={dual}
                            size={memoizedSize}
                            imageHeight={imageHeight}
                            onImageLongPress={openModal}
                        />
                    )}
                    <PostCardFooter
                        caption={caption}
                        category={category}
                        taskName={taskName}
                        reactions={localReactions}
                        userId={userId}
                        currentUserId={user?._id}
                        onReaction={handleReaction}
                        hasUserReacted={hasUserReacted}
                        onCongratulatePress={handleCongratulatePress}
                        onOpenComments={handleOpenComments}
                        commentCount={currentComments.length}
                    />
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
                        postId: id, // Pass the post ID for thumbnail
                    }}
                />
        </View>
    );
});


const stylesheet = (ThemedColor: any) =>
    StyleSheet.create({
        container: {
            borderBottomWidth: 1,
            borderBottomColor: ThemedColor.tertiary,
            paddingVertical: 8,
        },
        content: {
            paddingVertical: 12,
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

    });
export default PostCard;

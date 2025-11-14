import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { View, StyleSheet, TouchableOpacity, Platform, Alert, Keyboard, Dimensions } from "react-native";
import UserInfoRowComment from "../UserInfo/UserInfoRowComment";
import { ThemedText } from "../ThemedText";
import SendButton from "./SendButton";
import CommentInput from "./CommentInput";
import { useThemeColor } from "@/hooks/useThemeColor";
import { BottomSheetView, BottomSheetModal, BottomSheetFlatList } from "@gorhom/bottom-sheet";
import { addComment, deleteComment } from "@/api/post";
import { showToast } from "@/utils/showToast";
import { router } from "expo-router";

export type CommentProps = {
    id: string;
    user: {
        _id: string;
        display_name: string;
        handle: string;
        profile_picture: string;
    };
    content: string;
    parentId?: string;
    metadata: {
        createdAt: string;
        isDeleted: boolean;
        lastEdited: string;
    };
};

export type PopupProp = {
    comments: CommentProps[];
    postId?: string;
    ref: React.RefObject<BottomSheetModal>;
    onClose: () => void;
    onCommentAdded?: (comment: CommentProps) => void;
    onCommentDeleted?: (commentId: string) => void;
    currentUserId?: string;
    postOwnerId?: string;
};

const Comment = ({
    comments,
    postId,
    onCommentAdded,
    onCommentDeleted,
    currentUserId,
    postOwnerId,
    onClose,
}: PopupProp) => {
    const ThemedColor = useThemeColor();
    const styles = stylesheet(ThemedColor);

    const [commentText, setCommentText] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [replyingTo, setReplyingTo] = useState<{
        id: string;
        name: string;
        immediateParent?: string;
    } | null>(null);
    const [localComments, setLocalComments] = useState<CommentProps[]>(comments || []);
    const [autoFocusInput, setAutoFocusInput] = useState(false);
    const [deletingComments, setDeletingComments] = useState<Set<string>>(new Set());

    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

    // only update if comments changed
    useEffect(() => {
        setLocalComments(comments || []);
    }, [comments]);

    // gets keyboard height when keyboard is being used
    useEffect(() => {
        const showSub = Keyboard.addListener("keyboardDidShow", (e) => {
            setIsKeyboardVisible(true);
        });
        const hideSub = Keyboard.addListener("keyboardDidHide", () => {
            setIsKeyboardVisible(false);
        });
        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    // helper function to find the root parent of any comment
    const findRootParent = (commentId: string, commentsArray: CommentProps[]): string => {
        const comment = commentsArray.find((c) => c.id === commentId);
        if (!comment || !comment.parentId) {
            return commentId;
        }
        return findRootParent(comment.parentId, commentsArray);
    };

    // sort comments
    const sortCommentsHierarchically = (comments) => {
        // separate root comments from replies
        const rootComments = comments.filter((comment) => !comment.parentId);
        const replies = comments.filter((comment) => comment.parentId);

        // sort root comments by time
        const sortedRoots = rootComments.sort((a, b) => {
            const timeA = new Date(a.metadata.createdAt).getTime();
            const timeB = new Date(b.metadata.createdAt).getTime();
            return timeB - timeA;
        });

        // group replies by their root parent
        const repliesByRoot = {};
        replies.forEach((reply) => {
            const rootParentId = findRootParent(reply.parentId, comments);
            if (!repliesByRoot[rootParentId]) {
                repliesByRoot[rootParentId] = [];
            }
            repliesByRoot[rootParentId].push(reply);
        });

        // sort replies within each root group by time (chronologically - oldest first)
        Object.keys(repliesByRoot).forEach((rootId) => {
            repliesByRoot[rootId].sort((a, b) => {
                const timeA = new Date(a.metadata.createdAt).getTime();
                const timeB = new Date(b.metadata.createdAt).getTime();
                return timeA - timeB; // Changed to ascending order for chronological display
            });
        });

        // build final structure
        const result = [];
        sortedRoots.forEach((root) => {
            result.push(root);
            if (repliesByRoot[root.id]) {
                result.push(...repliesByRoot[root.id]);
            }
        });

        return result;
    };

    // get the sorted comments - memoized for performance
    const sortedComments = useMemo(() => {
        return sortCommentsHierarchically(localComments.filter((comment) => !deletingComments.has(comment.id)));
    }, [localComments, deletingComments]);

    // gets the time to show in how long ago a comment was made - memoized
    const getTimeAgo = useCallback((createdAt: string): string => {
        const now = new Date();
        const commentDate = new Date(createdAt);
        const diffInMs = now.getTime() - commentDate.getTime();
        const diffInSeconds = Math.floor(diffInMs / 1000);
        const diffInMinutes = Math.floor(diffInSeconds / 60);
        const diffInHours = Math.floor(diffInMinutes / 60);
        const diffInDays = Math.floor(diffInHours / 24);
        const diffInWeeks = Math.floor(diffInDays / 7);
        const diffInMonths = Math.floor(diffInDays / 30);
        const diffInYears = Math.floor(diffInDays / 365);

        if (diffInSeconds < 60) {
            return "just now";
        } else if (diffInMinutes < 60) {
            return diffInMinutes === 1 ? "1 min ago" : `${diffInMinutes} mins ago`;
        } else if (diffInHours < 24) {
            return diffInHours === 1 ? "1 hour ago" : `${diffInHours} hours ago`;
        } else if (diffInDays < 7) {
            return diffInDays === 1 ? "1 day ago" : `${diffInDays} days ago`;
        } else if (diffInWeeks < 4) {
            return diffInWeeks === 1 ? "1 week ago" : `${diffInWeeks} weeks ago`;
        } else if (diffInMonths < 12) {
            return diffInMonths === 1 ? "1 month ago" : `${diffInMonths} months ago`;
        } else {
            return diffInYears === 1 ? "1 year ago" : `${diffInYears} years ago`;
        }
    }, []);

    // permission check
    const canDeleteComment = (commentUserId: string): boolean => {
        if (!currentUserId) return false;
        return currentUserId === commentUserId || currentUserId === postOwnerId;
    };

    // handles the submitting comment
    const handleSubmitComment = async () => {
        if (!commentText.trim()) return;
        setIsSubmitting(true);

        try {
            // Use the root parent ID for proper threading
            const parentId = replyingTo?.id;
            let finalCommentText = commentText.trim();

            // Add mention if needed
            if (replyingTo && !finalCommentText.includes(`@${replyingTo.name}`)) {
                finalCommentText = `@${replyingTo.name} ${finalCommentText}`;
            }

            const newComment = await addComment(postId, finalCommentText, parentId);
            setCommentText("");
            setReplyingTo(null);

            setLocalComments((prev) => [...prev, newComment]);

            if (onCommentAdded) {
                onCommentAdded(newComment);
            }
        } catch (error) {
            console.error("Failed to submit comment:", error);
            showToast("Failed to add comment", "danger");
        } finally {
            setIsSubmitting(false);
        }
    };

    // handles replying - memoized
    const handleReply = useCallback(
        (commentId: string, userName: string) => {
            const rootParentId = findRootParent(commentId, localComments);

            setReplyingTo({
                id: rootParentId,
                name: userName,
                immediateParent: commentId,
            });

            setCommentText(`@${userName} `);
            setAutoFocusInput(true);
        },
        [localComments]
    );

    // handle deleting
    const handleDeleteComment = (commentId: string, commentUserId: string) => {
        if (!canDeleteComment(commentUserId)) {
            showToast("You can only delete your own comments", "danger");
            return;
        }

        Alert.alert("Delete Comment", "Are you sure you want to delete this comment?", [
            {
                text: "Cancel",
                style: "cancel",
            },
            {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                    setDeletingComments((prev) => new Set([...prev, commentId]));

                    try {
                        await deleteComment(postId, commentId);

                        // Remove from local state
                        setLocalComments((prev) => prev.filter((c) => c.id !== commentId));

                        if (onCommentDeleted) {
                            onCommentDeleted(commentId);
                        }

                        showToast("Comment deleted successfully", "success");
                    } catch (error) {
                        console.error("Failed to delete comment:", error);

                        if (error.message && error.message.includes("Comment not found")) {
                            setLocalComments((prev) => prev.filter((c) => c.id !== commentId));
                            if (onCommentDeleted) {
                                onCommentDeleted(commentId);
                            }
                            showToast("Comment deleted", "success");
                        } else {
                            setDeletingComments((prev) => {
                                const newSet = new Set(prev);
                                newSet.delete(commentId);
                                return newSet;
                            });
                            showToast("Failed to delete comment", "danger");
                        }
                    }
                },
            },
        ]);
    };

    // handles the long press on a comment
    const handleLongPress = (commentId: string, commentUserId: string) => {
        if (!canDeleteComment(commentUserId)) {
            return;
        }

        Alert.alert("Comment Options", "", [
            {
                text: "Delete Comment",
                style: "destructive",
                onPress: () => handleDeleteComment(commentId, commentUserId),
            },
            {
                text: "Cancel",
                style: "cancel",
            },
        ]);
    };

    // Render comment item - memoized
    const renderCommentItem = useCallback(
        ({ item: comment }: { item: CommentProps }) => {
            const canDelete = canDeleteComment(comment.user._id);
            const isDeleting = deletingComments.has(comment.id);

            return (
                <TouchableOpacity
                    style={[
                        styles.commentItem,
                        comment.parentId && styles.replyComment,
                        isDeleting && styles.deletingComment,
                    ]}
                    onLongPress={
                        canDelete && !isDeleting ? () => handleLongPress(comment.id, comment.user._id) : undefined
                    }
                    onPress={() => {
                        onClose();
                        router.push(`/account/${comment.user._id}`);
                    }}
                    delayLongPress={500}
                    activeOpacity={isDeleting ? 1 : 0.7}>
                    <UserInfoRowComment
                        name={comment.user.display_name}
                        content={comment.content}
                        icon={comment.user.profile_picture}
                        time={getTimeAgo(comment.metadata.createdAt)} // Now returns a string
                        id={comment.id}
                        onReply={!isDeleting ? handleReply : undefined}
                    />
                    {isDeleting && <ThemedText style={styles.deletingText}>Deleting...</ThemedText>}
                </TouchableOpacity>
            );
        },
        [deletingComments, currentUserId, postOwnerId, handleReply, onClose, getTimeAgo]
    );

    // Empty list component
    const ListEmptyComponent = useCallback(
        () => (
            <View style={styles.emptyContainer}>
                <ThemedText style={{ color: ThemedColor.caption }}>
                    No comments yet. Be the first to comment!
                </ThemedText>
            </View>
        ),
        [ThemedColor]
    );

    return (
        <BottomSheetView style={styles.modalContainer}>
            <View style={styles.header}>
                <ThemedText style={styles.commentsTitle}>Comments ({sortedComments?.length || 0})</ThemedText>
            </View>
            <BottomSheetFlatList
                data={sortedComments}
                renderItem={renderCommentItem}
                keyExtractor={(item) => item.id}
                ListEmptyComponent={ListEmptyComponent}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                removeClippedSubviews={true}
                maxToRenderPerBatch={10}
                windowSize={10}
                initialNumToRender={10}
                style={styles.flatList}
            />
            <View style={styles.inputContainer}>
                <View style={styles.inputRow}>
                    <CommentInput
                        autoFocus={autoFocusInput}
                        placeHolder={replyingTo ? `Reply to ${replyingTo.name}...` : "Leave a comment"}
                        onChangeText={setCommentText}
                        onSubmit={handleSubmitComment}
                        value={commentText}
                    />
                    <SendButton onSend={handleSubmitComment} />
                </View>
            </View>
        </BottomSheetView>
    );
};

const stylesheet = (ThemedColor: any) =>
    StyleSheet.create({
        modalContainer: {
            flex: 1,
            backgroundColor: ThemedColor.background,
            paddingHorizontal: 16,
            justifyContent: "space-between",
            height: "100%",
        },
        header: {
            alignItems: "center",
            paddingVertical: 16,
            borderBottomWidth: 1,
            borderBottomColor: ThemedColor.tertiary,
            marginBottom: 8,
        },
        commentsTitle: {
            fontSize: 18,
            fontWeight: "600",
            color: ThemedColor.text,
        },
        flatList: {
            flex: 1,
            height: "100%",
        },
        contentContainer: {
            flexGrow: 1,
            paddingBottom: 8,
        },
        commentItem: {
            marginVertical: 8,
        },
        replyComment: {
            marginLeft: 20,
            paddingLeft: 12,
            borderLeftWidth: 1,
            borderLeftColor: ThemedColor.tertiary,
        },
        deletingComment: {
            opacity: 0.5,
        },
        deletingText: {
            fontSize: 12,
            color: ThemedColor.caption,
            fontStyle: "italic",
            marginTop: 4,
        },
        inputContainer: {
            paddingVertical: 12,
            paddingHorizontal: 4,
            borderTopWidth: 1,
            borderTopColor: ThemedColor.tertiary,
            backgroundColor: ThemedColor.background,
            minHeight: 70,
        },
        inputRow: {
            flexDirection: "row",
            alignItems: "flex-end",
            gap: 8,
            paddingBottom: 12,
        },
        emptyContainer: {
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingVertical: 40,
            minHeight: 240,
        },
    });

export default Comment;

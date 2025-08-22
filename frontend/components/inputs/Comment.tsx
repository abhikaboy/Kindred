import React, { useEffect, useRef, useState } from "react";
import {
    View,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Platform,
    Alert,
    Keyboard,
    KeyboardAvoidingView,
} from "react-native";
import UserInfoRowComment from "../UserInfo/UserInfoRowComment";
import { ThemedText } from "../ThemedText";
import SendButton from "./SendButton";
import CommentInput from "./CommentInput";
import { useThemeColor } from "@/hooks/useThemeColor";
import { BottomSheetView, BottomSheetModal } from "@gorhom/bottom-sheet";
import { addComment, deleteComment } from "@/api/post";
import { showToast } from "@/utils/showToast";

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

const Comment = ({ comments, postId, onCommentAdded, onCommentDeleted, currentUserId, postOwnerId }: PopupProp) => {
    const ThemedColor = useThemeColor();
    const styles = stylesheet(ThemedColor);

    const [commentText, setCommentText] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [replyingTo, setReplyingTo] = useState<{ id: string; name: string } | null>(null);
    const [localComments, setLocalComments] = useState<CommentProps[]>(comments || []);
    const [autoFocusInput, setAutoFocusInput] = useState(false);
    const [deletingComments, setDeletingComments] = useState<Set<string>>(new Set());

    // only update if comments changed
    useEffect(() => {
        setLocalComments(comments || []);
    }, [comments]);

    // gets keyboard height when keyboard is being used
    useEffect(() => {
        const showSub = Keyboard.addListener("keyboardDidShow", (e) => {});
        const hideSub = Keyboard.addListener("keyboardDidHide", () => {});
        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    // sort comments where its reverse chronological for replies + parents separately
    const sortCommentsHierarchically = (comments) => {
        // separate parent comments from replies
        const parentComments = comments.filter((comment) => !comment.parentId);
        const replies = comments.filter((comment) => comment.parentId);

        // sort parent comments in reverse chronological order
        const sortedParents = parentComments.sort((a, b) => {
            const timeA = new Date(a.metadata.createdAt).getTime();
            const timeB = new Date(b.metadata.createdAt).getTime();
            return timeB - timeA;
        });

        // create a map of replies grouped by their parent ID
        const repliesByParent = replies.reduce((acc, reply) => {
            if (!acc[reply.parentId]) {
                acc[reply.parentId] = [];
            }
            acc[reply.parentId].push(reply);
            return acc;
        }, {});

        // sort replies within each parent group
        Object.keys(repliesByParent).forEach((parentId) => {
            repliesByParent[parentId].sort((a, b) => {
                const timeA = new Date(a.metadata.createdAt).getTime();
                const timeB = new Date(b.metadata.createdAt).getTime();
                return timeB - timeA;
            });
        });

        // build the result
        const result = [];
        sortedParents.forEach((parent) => {
            result.push(parent);
            if (repliesByParent[parent.id]) {
                result.push(...repliesByParent[parent.id]);
            }
        });

        return result;
    };

    // get the sorted comments
    const sortedComments = sortCommentsHierarchically(
        localComments.filter((comment) => !deletingComments.has(comment.id))
    );

    // gets the time to show in how long ago a comment was made
    const getTimeAgo = (createdAt: string): number => {
        return Math.abs(new Date().getTime() - new Date(createdAt).getTime()) / 36e5;
    };

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
            const parentId = replyingTo?.id;
            let finalCommentText = commentText.trim();

            // adds mention if needed
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

    // handles replying
    const handleReply = (commentId: string, userName: string) => {
        setReplyingTo({ id: commentId, name: userName });
        setCommentText(`@${userName} `);
        setAutoFocusInput(true);
    };

    // handle deleting
    const handleDeleteComment = (commentId: string, commentUserId: string) => {
        if (!canDeleteComment(commentUserId)) {
            showToast("You can only delete your own comments", "danger");
            return;
        }

        // second alert
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

                        // remove from the local state
                        setLocalComments((prev) => prev.filter((c) => c.id !== commentId));

                        // notify the parent
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

        // first alert
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

    return (
        <BottomSheetView style={styles.modalContainer}>
            <View style={styles.container}>
                <View style={styles.header}>
                    <ThemedText style={styles.commentsTitle}>Comments ({sortedComments?.length || 0})</ThemedText>
                </View>
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.contentContainer}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled">
                    {sortedComments.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <ThemedText style={{ color: ThemedColor.caption }}>
                                No comments yet. Be the first to comment!
                            </ThemedText>
                        </View>
                    ) : (
                        sortedComments.map((comment, index) => {
                            const canDelete = canDeleteComment(comment.user._id);
                            const isDeleting = deletingComments.has(comment.id);

                            return (
                                <TouchableOpacity
                                    key={comment.id}
                                    style={[
                                        styles.commentItem,
                                        comment.parentId && styles.replyComment,
                                        isDeleting && styles.deletingComment,
                                    ]}
                                    onLongPress={
                                        canDelete && !isDeleting
                                            ? () => handleLongPress(comment.id, comment.user._id)
                                            : undefined
                                    }
                                    delayLongPress={500}
                                    activeOpacity={isDeleting ? 1 : 0.7}>
                                    <UserInfoRowComment
                                        name={comment.user.display_name}
                                        content={comment.content}
                                        icon={comment.user.profile_picture}
                                        time={getTimeAgo(comment.metadata.createdAt)}
                                        id={comment.id}
                                        onReply={!isDeleting ? handleReply : undefined}
                                    />
                                    {isDeleting && <ThemedText style={styles.deletingText}>Deleting...</ThemedText>}
                                </TouchableOpacity>
                            );
                        })
                    )}
                </ScrollView>
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : undefined}
                    keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
                    style={{ flexDirection: "column", justifyContent: "flex-end" }}>
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
                </KeyboardAvoidingView>
            </View>
        </BottomSheetView>
    );
};

const stylesheet = (ThemedColor: any) =>
    StyleSheet.create({
        modalContainer: {
            flex: 1,
            backgroundColor: ThemedColor.background,
        },
        container: {
            flex: 1,
            paddingHorizontal: 16,
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
        scrollView: {
            flex: 1,
        },
        contentContainer: {
            paddingBottom: 20,
            flexGrow: 1,
        },
        commentItem: {
            marginVertical: 8,
        },
        replyComment: {
            marginLeft: 20,
            paddingLeft: 12,
            borderLeftWidth: 2,
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
        },
        inputRow: {
            flexDirection: "row",
            alignItems: "flex-end",
            gap: 8,
        },
        emptyContainer: {
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingVertical: 40,
        },
    });

export default Comment;

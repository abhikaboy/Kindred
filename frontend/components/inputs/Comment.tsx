import React, { useEffect, useRef, useState } from "react";
import {
    View,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Dimensions,
    Platform,
    Alert,
    Keyboard,
    KeyboardAvoidingView,
    TextInput,
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
    userId: string;
    user: {
        _id: string;
        display_name: string;
        handle: string;
        profile_picture: string;
    };
    content: string;
    parentId?: string;
    mention?: string;
    metadata: {
        createdAt: string;
        isDeleted: boolean;
        lastEdited: string;
    };
};

export type PopupProp = {
    comments: CommentProps[] | any[];
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
    ref,
    onClose,
    onCommentAdded,
    onCommentDeleted,
    currentUserId,
    postOwnerId,
}: PopupProp) => {
    const ThemedColor = useThemeColor();
    const styles = stylesheet(ThemedColor);
    const [commentText, setCommentText] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [replyingTo, setReplyingTo] = useState<{ id: string; name: string } | null>(null);
    const [localComments, setLocalComments] = useState<CommentProps[]>(comments || []);
    const inputRef = useRef<TextInput>(null);
    const [autoFocusInput, setAutoFocusInput] = useState(false);
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    const isAPIComment = (comment: any) => comment && comment.user && comment.metadata;

    useEffect(() => {
        setLocalComments(comments || []);
    }, [comments]);
    useEffect(() => {
        const showSub = Keyboard.addListener("keyboardDidShow", (e) => setKeyboardHeight(e.endCoordinates.height));
        const hideSub = Keyboard.addListener("keyboardDidHide", () => setKeyboardHeight(0));
        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);
    const sortedComments = [...localComments].sort((a, b) => {
        if (a.parentId && b.parentId) {
            if (a.parentId === b.parentId) {
                return new Date(a.metadata?.createdAt || 0).getTime() - new Date(b.metadata?.createdAt || 0).getTime();
            }
            return a.parentId.localeCompare(b.parentId);
        }
        return new Date(a.metadata?.createdAt || 0).getTime() - new Date(b.metadata?.createdAt || 0).getTime();
    });

    const handleSubmitComment = async () => {
        if (!commentText.trim()) return;

        setIsSubmitting(true);

        try {
            const parentId = replyingTo?.id;
            let finalCommentText = commentText.trim();
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

    const handleReply = (commentId: string, userName: string) => {
        setReplyingTo({ id: commentId, name: userName });
        setCommentText(`@${userName} `);
        setAutoFocusInput(true);
    };

    const handleDeleteComment = (commentId: string, commentUserId: string) => {
        const canDelete = currentUserId === commentUserId || currentUserId === postOwnerId;

        if (!canDelete) {
            showToast("You can only delete your own comments", "danger");
            return;
        }

        const findCommentsToDelete = (targetId: string): string[] => {
            const toDelete = [targetId];
            const findChildren = (parentId: string) => {
                localComments.forEach((comment) => {
                    if (comment.parentId === parentId) {
                        toDelete.push(comment.id);
                        findChildren(comment.id);
                    }
                });
            };
            findChildren(targetId);
            return toDelete;
        };

        const commentsToDelete = findCommentsToDelete(commentId);

        Alert.alert("Delete Comment", "Are you sure you want to delete this comment?", [
            {
                text: "Cancel",
                style: "cancel",
            },
            {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                    try {
                        await deleteComment(postId, commentId);
                        showToast(
                            commentsToDelete.length > 1
                                ? `Comment and ${commentsToDelete.length - 1} replies deleted successfully`
                                : "Comment deleted successfully",
                            "success"
                        );

                        setLocalComments((prev) => prev.filter((c) => !commentsToDelete.includes(c.id)));

                        if (onCommentDeleted) {
                            commentsToDelete.forEach((id) => onCommentDeleted(id));
                        }
                    } catch (error) {
                        console.error("Failed to delete comment:", error);
                        showToast("Failed to delete comment", "danger");
                    }
                },
            },
        ]);
    };

    const handleLongPress = (commentId: string, commentUserId: string) => {
        const canDelete = currentUserId === commentUserId || currentUserId === postOwnerId;

        if (!canDelete) return;

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
                {/* Header */}
                <View style={styles.header}>
                    <ThemedText style={styles.commentsTitle}>Comments ({localComments?.length || 0})</ThemedText>
                </View>

                {/* Comments List */}
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
                        sortedComments.map((comment, index) => (
                            <TouchableOpacity
                                key={comment.id || index}
                                style={[styles.commentItem, comment.parentId && styles.replyComment]}
                                onLongPress={() => handleLongPress(comment.id, comment.user?._id)}
                                delayLongPress={500}
                                activeOpacity={0.7}>
                                <UserInfoRowComment
                                    name={comment.user?.display_name}
                                    content={comment.content}
                                    icon={comment.user?.profile_picture}
                                    time={
                                        isAPIComment(comment)
                                            ? comment.metadata?.createdAt
                                                ? Math.abs(
                                                      new Date().getTime() -
                                                          new Date(comment.metadata.createdAt).getTime()
                                                  ) / 36e5
                                                : 0
                                            : comment.time
                                    }
                                    id={comment.id}
                                    onReply={handleReply}
                                />
                            </TouchableOpacity>
                        ))
                    )}
                </ScrollView>

                {/* Input Section */}
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "undefined"}
                    keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0} // adjust if needed
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
        inputContainer: {
            paddingVertical: 12,
            paddingHorizontal: 4,
            borderTopWidth: 1,
            borderTopColor: ThemedColor.tertiary,
            backgroundColor: ThemedColor.background,
        },
        replyIndicator: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingHorizontal: 12,
            paddingVertical: 8,
            backgroundColor: ThemedColor.lightened,
            borderRadius: 8,
            marginBottom: 8,
        },
        replyText: {
            fontSize: 14,
            color: ThemedColor.caption,
        },
        cancelReply: {
            fontSize: 16,
            color: ThemedColor.caption,
            fontWeight: "bold",
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

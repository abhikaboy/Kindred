import React, { useState } from "react";
import {
    View,
    StyleSheet,
    TouchableOpacity,
    Text,
    ScrollView,
    Dimensions,
    Animated,
    TouchableWithoutFeedback,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import Modal from "react-native-modal";
import UserInfoRowComment from "../UserInfo/UsereInfoRowComment";
import { ThemedText } from "../ThemedText";
import ThemedInput from "./ThemedInput";
import SendButton from "./SendButton";
import CommentInput from "./CommentInput";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useAnimatedGestureHandler, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { useSharedValue } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import BottomSheet, { BottomSheetView, BottomSheetModal } from "@gorhom/bottom-sheet";
import { addComment } from "@/api/post";
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
};

const Comment = ({ comments, postId, ref, onClose, onCommentAdded }: PopupProp) => {
    const ThemedColor = useThemeColor();
    const styles = stylesheet(ThemedColor);
    const [commentText, setCommentText] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isAPIComment = (comment: any) => comment && comment.user && comment.metadata;

    const handleSubmitComment = async () => {
        setIsSubmitting(true);

        try {
            const newComment = await addComment(postId, commentText.trim());
            setCommentText("");

            if (onCommentAdded) {
                onCommentAdded(newComment);
            }
        } catch (error) {
            console.error("Failed to submit comment:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <BottomSheetView style={styles.modalContainer}>
            <View style={styles.modalContent}>
                <View style={styles.header}>
                    <ThemedText style={styles.commentsTitle} type="default">
                        Comments ({comments?.length || 0})
                    </ThemedText>
                </View>

                <ScrollView
                    style={styles.commentsContainer}
                    contentContainerStyle={styles.contentContainer}
                    showsVerticalScrollIndicator={true}
                    indicatorStyle="black">
                    {!comments || comments.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <ThemedText style={[styles.emptyText, { color: ThemedColor.caption }]}>
                                No comments yet. Be the first to comment!
                            </ThemedText>
                        </View>
                    ) : (
                        comments.map((comment, index) => {
                            console.log(
                                isAPIComment(comment) ? "API format" : "Legacy format"
                            );

                            return (
                                <View key={comment.id || index} style={styles.comments}>
                                    <UserInfoRowComment
                                        name={isAPIComment(comment) ? comment.user?.display_name : comment.name}
                                        content={comment.content}
                                        icon={isAPIComment(comment) ? comment.user?.profile_picture : comment.icon}
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
                                    />
                                </View>
                            );
                        })
                    )}
                </ScrollView>

                <View style={styles.inputContainer}>
                    <CommentInput
                        placeHolder="Leave a comment"
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
        },
        modalContent: {
            width: "100%",
            backgroundColor: ThemedColor.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingBottom: 32,
            elevation: 5,
        },
        header: {
            alignItems: "center",
            marginBottom: 10,
        },
        line: {
            borderBottomWidth: 1,
            borderBottomColor: "white",
            width: 50,
            marginTop: 21,
            marginBottom: 10,
        },
        commentsTitle: {
            flexDirection: "row",
            alignItems: "center",
        },
        commentsContainer: {
            maxHeight: Dimensions.get("window").height * 0.6,
            width: "100%",
            marginBottom: 20,
        },
        comments: {
            marginTop: 23,
            flexWrap: "wrap",
            flexShrink: 1,
        },
        contentContainer: {
            paddingHorizontal: Dimensions.get("window").width * 0.04,
        },
        inputContainer: {
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            gap: 10,
            paddingHorizontal: 16,
            paddingBottom: Platform.OS === "ios" ? 20 : 10,
        },
        emptyContainer: {
            padding: 20,
            alignItems: "center",
        },
        emptyText: {
            fontSize: 16,
            textAlign: "center",
        },
    });

export default Comment;

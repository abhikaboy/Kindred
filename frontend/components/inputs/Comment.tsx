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

export type CommentProps = {
    userId: number;
    icon: string;
    name: string;
    username: string;
    time: number;
    content: string;
};

export type PopupProp = {
    comments: CommentProps[];
    ref: React.RefObject<BottomSheetModal>;
    onClose: () => void;
};

const Comment = ({ comments, ref, onClose }: PopupProp) => {
    const ThemedColor = useThemeColor();
    const styles = stylesheet(ThemedColor);
    const [commentText, setCommentText] = useState("");

    const handleSubmitComment = () => {
        if (commentText.trim()) {
            // Here you would typically make an API call to submit the comment
            console.log("Submitting comment:", commentText);
            setCommentText("");
            // You could also call onClose() here if you want to close the modal after submitting
        }
    };

    return (
        <BottomSheetView style={styles.modalContainer}>
            <View style={styles.modalContent}>
                <View style={styles.header}>
                    <ThemedText style={styles.commentsTitle} type="default">
                        Comments
                    </ThemedText>
                </View>
                <ScrollView
                    style={styles.commentsContainer}
                    contentContainerStyle={styles.contentContainer}
                    showsVerticalScrollIndicator={true}
                    indicatorStyle="black">
                    {comments?.map((comment, index) => (
                        <View key={index} style={styles.comments}>
                            <UserInfoRowComment
                                key={index}
                                name={comment.name}
                                content={comment.content}
                                icon={comment.icon}
                            />
                        </View>
                    ))}
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
    });

export default Comment;

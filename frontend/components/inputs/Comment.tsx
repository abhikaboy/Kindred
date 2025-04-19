import React from "react";
import {
    View,
    StyleSheet,
    TouchableOpacity,
    Text,
    ScrollView,
    Dimensions,
    Animated,
    TouchableWithoutFeedback,
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

                <View
                    style={{
                        flexDirection: "row",
                        justifyContent: "center",
                        gap: 10,
                    }}>
                    <CommentInput placeHolder="Leave a comment" />
                    <SendButton
                        onSend={() => {
                            onClose();
                        }}
                    />
                </View>
            </View>
        </BottomSheetView>
    );
};
let ThemedColor = useThemeColor();

const styles = StyleSheet.create({
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
        maxHeight: Dimensions.get("window").height * 0.7,
        width: "100%",
        marginBottom: 30,
    },
    comments: {
        marginTop: 23,
        flexWrap: "wrap",
        flexShrink: 1,
    },
    contentContainer: {
        paddingHorizontal: Dimensions.get("window").width * 0.04,
    },
});

export default Comment;

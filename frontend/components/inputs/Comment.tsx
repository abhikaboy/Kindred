import React from "react";
import { Modal, View, StyleSheet, TouchableOpacity, Text, ScrollView, Dimensions } from "react-native";
import UserInfoRowComment from "../UserInfo/UsereInfoRowComment";
import { ThemedText } from "../ThemedText";
import ThemedColor from "@/constants/Colors";
import ThemedInput from "./ThemedInput";
import SendButton from "./SendButton";
import CommentInput from "./CommentInput";

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
    show: boolean;
    onClose: () => void;
};

const Comment = ({ comments, show, onClose }: PopupProp) => {
    return (
        <Modal visible={show} transparent={true} animationType="slide" onRequestClose={onClose}>
            <View style={[styles.modalContainer, show && styles.modalVisible]}>
                <View style={styles.modalContent}>
                    <View style={styles.header}>
                        <View style={styles.line} />
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
                        <SendButton onSend={() => {}} />
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        justifyContent: "flex-end",
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.5)",
        opacity: 0,
        transform: [{ translateY: 100 }],
    },
    modalVisible: {
        opacity: 1,
        transform: [{ translateY: 0 }],
    },
    modalContent: {
        width: "100%",
        backgroundColor: ThemedColor.background,
        borderTopLeftRadius: 26,
        borderTopRightRadius: 26,
        paddingBottom: 30,
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

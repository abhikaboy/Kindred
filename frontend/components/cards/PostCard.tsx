import React, { useState } from "react";
import { Modal, Image, TouchableOpacity, View, StyleSheet, Dimensions } from "react-native";
import { ThemedText } from "../ThemedText";
import { Colors } from "@/constants/Colors";
import UserInfoRowTimed from "../UserInfo/UserInfoRowTimed";
import ReactPills from "../inputs/ReactPills";
import ReactionAction from "../inputs/ReactionAction";

type SlackReaction = {
    emoji: string;
    count: number;
};

type Props = {
    icon: string;
    name: string;
    username: string;
    caption: string;
    time: number;
    priority: string;
    points: number;
    timeTaken: number;
    reactions: SlackReaction[];
    image: string;
    id?: string;
};

const PostCard = ({
    icon,
    name,
    username,
    caption,
    time,
    priority,
    points,
    timeTaken,
    reactions: initialReactions,
    image,
}: Props) => {
    const [modalVisible, setModalVisible] = useState(false);
    const [reactions, setReactions] = useState<SlackReaction[]>(initialReactions);
    const [newReactions, setNewReactions] = useState<SlackReaction[]>();

    const handleAddReaction = (emoji: string) => {
        setNewReactions((prevReactions = []) => {
            const existingReaction = prevReactions.find((r) => r.emoji === emoji);
            if (existingReaction) {
                return prevReactions.map((r) => (r.emoji === emoji ? { ...r } : r));
            } else {
                return [...prevReactions, { emoji, count: 0 }];
            }
        });
    };

    return (
        <TouchableOpacity style={styles.container}>
            <View style={{ flexDirection: "column", marginVertical: 15 }}>
                <UserInfoRowTimed name={name} username={username} time={time} icon={icon} />
                <View style={styles.col}>
                    <ThemedText type="defaultSemiBold">{caption}</ThemedText>
                    <View style={styles.row}>
                        <ThemedText type="lightBody">❗ {priority}</ThemedText>
                        <ThemedText type="lightBody">💪 {points} pts</ThemedText>
                        <ThemedText type="lightBody">⏰ {timeTaken} hrs</ThemedText>
                    </View>
                    <TouchableOpacity onPress={() => setModalVisible(true)}>
                        <Image src={image} style={styles.image} />
                    </TouchableOpacity>
                </View>

                <View style={styles.reactionsRow}>
                    {reactions?.map((react, index) => (
                        <ReactPills key={index} emoji={react.emoji} count={react.count} reacted={false} postId={0} />
                    ))}
                    {newReactions?.map((react, index) => (
                        <ReactPills key={index} emoji={react.emoji} count={react.count} reacted={true} postId={0} />
                    ))}
                    <ReactionAction onAddReaction={(emoji) => handleAddReaction(emoji)} postId={0} />
                </View>

                <TouchableOpacity>
                    <ThemedText style={{ paddingTop: 15 }} type="lightBody">
                        💬 Leave a comment
                    </ThemedText>
                </TouchableOpacity>
            </View>

            <Modal
                visible={modalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setModalVisible(false)}>
                <TouchableOpacity style={styles.modalContainer} onPress={() => setModalVisible(false)}>
                    <View style={styles.modalContent}>
                        <Image src={image} style={styles.popupImage} />
                        <TouchableOpacity onPress={() => setModalVisible(false)}></TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </TouchableOpacity>
    );
};

export default PostCard;

const styles = StyleSheet.create({
    image: {
        width: Dimensions.get("window").width * 0.87,
        height: Dimensions.get("window").width * 0.87,
        borderRadius: 20,
    },
    container: {
        flex: 1,
        flexDirection: "column",
        paddingVertical: 30,
    },
    row: {
        flexDirection: "row",
        gap: 6,
        marginRight: -6,
    },
    col: {
        marginTop: 10,
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 10,
    },
    reactionsRow: {
        marginTop: 18,
        gap: 8,
        flexDirection: "row",
        justifyContent: "flex-start",
        width: Dimensions.get("window").width * 0.87,
        flexWrap: "wrap",
    },
    modalContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
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

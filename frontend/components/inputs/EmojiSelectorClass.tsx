import React, { useState } from "react";
import { Modal, TouchableOpacity, View, StyleSheet } from "react-native";
import EmojiSelector from "react-native-emoji-selector";
import { Colors } from "@/constants/Colors";

type EmojiSelectorProps = {
    showSelector: boolean;
    onAddReaction: (emoji: string, count: number, ids: string[]) => void;
    onClose: () => void;
};

const EmojiSelectorClass = ({ showSelector, onAddReaction, onClose }: EmojiSelectorProps) => {
    const userId = "67ba5abb616b5e6544e0137b";

    return (
        <Modal visible={showSelector} transparent={true} animationType="fade" onRequestClose={onClose}>
            <TouchableOpacity style={styles.modalContainer} onPress={onClose}>
                <View style={styles.modalContent}>
                    <EmojiSelector
                        onEmojiSelected={(emoji) => {
                            onAddReaction(emoji, 1, [userId]);
                            onClose();
                        }}
                    />
                </View>
            </TouchableOpacity>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
    },
    modalContent: {
        backgroundColor: Colors.dark.background,
        padding: 20,
        paddingBottom: 60,
        borderRadius: 20,
        width: "80%",
        height: "60%",
    },
});

export default EmojiSelectorClass;

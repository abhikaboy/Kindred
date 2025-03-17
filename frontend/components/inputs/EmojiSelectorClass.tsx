import React, { useState, useRef, useEffect } from "react";
import { Modal, TouchableOpacity, View, StyleSheet } from "react-native";
import EmojiSelector from "react-native-emoji-selector";
import ThemedColor from "@/constants/Colors";
import { Dimensions } from "react-native";

type EmojiSelectorProps = {
    showSelector: boolean;
    onAddReaction: (emoji: string, count: number, ids: string[]) => void;
    onClose: () => void;
};

const EmojiSelectorClass = ({ showSelector, onAddReaction, onClose }: EmojiSelectorProps) => {
    const userId = "67ba5abb616b5e6544e0137b";

    return (
        <View style={styles.viewContainer}>
            <Modal
                visible={showSelector}
                style={styles.modalContainer}
                transparent={true}
                animationType="slide"
                onRequestClose={onClose}>
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
        </View>
    );
};

const styles = StyleSheet.create({
    viewContainer: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        animationFillMode: "fade",
    },
    modalContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingTop: Dimensions.get("screen").height * 0.45,
        width: Dimensions.get("screen").width,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
    },
    modalContent: {
        backgroundColor: ThemedColor.background,
        padding: 20,
        paddingBottom: 60,
        borderRadius: 20,
        width: "100%",
        height: "100%",
    },
});

export default EmojiSelectorClass;

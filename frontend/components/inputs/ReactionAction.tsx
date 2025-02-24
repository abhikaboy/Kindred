import React, { useState } from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import EmojiSelectorClass from "./EmojiSelectorClass";

type ReactionActionProps = {
    postId: number;
    onAddReaction: (emoji: string, count: number, ids: string[]) => void;
};

const ReactionAction = ({ onAddReaction }: ReactionActionProps) => {
    const [showEmojiSelector, setShowEmojiSelector] = useState(false);

    return (
        <View>
            <TouchableOpacity
                onPress={() => setShowEmojiSelector(true)}
                style={styles.reactionButton}>
                <Text style={styles.reactionButtonText}>+</Text>
            </TouchableOpacity>
            {showEmojiSelector && (
                <EmojiSelectorClass
                    showSelector={showEmojiSelector}
                    onAddReaction={onAddReaction}
                    onClose={() => setShowEmojiSelector(false)} 
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    reactionButton: {
        flexDirection: "row",
        backgroundColor: "#321E5D",
        borderStyle: "solid",
        borderColor: "#321E5D",
        borderWidth: 1.4,
        borderRadius: 23,
        paddingHorizontal: 18,
        paddingVertical: 6,
        gap: 6,
        alignSelf: "flex-start",
    },
    reactionButtonText: {
        color: "white",
        fontSize: 18,
    },
});

export default ReactionAction;
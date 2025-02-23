import React, { useState } from "react";
import { View, TouchableOpacity, Text } from "react-native";
import EmojiSelector from "react-native-emoji-selector";

type ReactionActionProps = {
    postId: number;
    onAddReaction: (emoji: string) => void;
};

const ReactionAction = ({ onAddReaction }: ReactionActionProps) => {
    const [showEmojiSelector, setShowEmojiSelector] = useState(false);

    return (
        <View>
            <TouchableOpacity
                onPress={() => setShowEmojiSelector(true)}
                style={{
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
                }}>
                <Text style={{ color: "white", fontSize: 18 }}>+</Text>
            </TouchableOpacity>

            {showEmojiSelector && (
                <EmojiSelector
                    onEmojiSelected={(emoji) => {
                        onAddReaction(emoji);
                        setShowEmojiSelector(false);
                    }}
                />
            )}
        </View>
    );
};

export default ReactionAction;

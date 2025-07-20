import React, { useState } from "react";
import { View, TouchableOpacity, Text, StyleSheet, Dimensions } from "react-native";
import EmojiSelectorClass from "./EmojiSelectorClass";
import { useThemeColor } from "@/hooks/useThemeColor";

type ReactionActionProps = {
    postId: number;
    onAddReaction: (emoji: string, count: number, ids: string[]) => void;
};

const ReactionAction = ({ onAddReaction }: ReactionActionProps) => {
    const [showEmojiSelector, setShowEmojiSelector] = useState(false);
    const ThemedColor = useThemeColor();
    const styles = stylesheet(ThemedColor);

    return (
        <View>
            <TouchableOpacity onPress={() => setShowEmojiSelector(true)} style={styles.reactionButton}>
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

const stylesheet = (ThemedColor: any) =>
    StyleSheet.create({
        reactionButton: {
            flexDirection: "row",
            backgroundColor: "#3f1d4c",
            borderStyle: "solid",
            borderColor: "#3f1d4c",
            borderWidth: 1.4,
            borderRadius: 23,
            paddingHorizontal: 9,
            paddingVertical: 4,
            alignSelf: "flex-start",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 31,
            minHeight: 29,
        },
        reactionButtonText: {
            color: ThemedColor.buttonText,
            fontSize: 20,
            fontWeight: "300",
        },
    });

export default ReactionAction;

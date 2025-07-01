import * as React from "react";
import { useState } from "react";
import { Text, StyleSheet, View, TouchableOpacity } from "react-native";
import { ThemedText } from "../ThemedText";
import { SlackReaction } from "../cards/PostCard";

type Props = {
    postId: number;
    reaction: SlackReaction;
    onAddReaction: (emoji: string, count: number, ids: string[]) => void;
    onRemoveReaction: (emoji: string, count: number, ids: string[]) => void;
};

const ReactPills = ({ reaction, onAddReaction, onRemoveReaction }: Props) => {
    const userId = "67ba5abb616b5e6544e0137b";

    const getHasReacted = (reaction: SlackReaction, userId: string) => {
        if (!reaction || !reaction.ids) return false;
        const idsSet = new Set(reaction.ids ?? []);
        return idsSet.has(userId);
    };

    const [hasReacted, setHasReacted] = useState(getHasReacted(reaction, userId));

    if (reaction?.count === 0 && !hasReacted) {
        return null;
    }

    return (
        <TouchableOpacity
            onPress={() => {
                setHasReacted(!hasReacted);
                if (!hasReacted) {
                    onAddReaction(reaction?.emoji, reaction?.count, [...reaction?.ids, userId]);
                }
                if (hasReacted) {
                    onRemoveReaction(reaction?.emoji, reaction?.count, [...reaction?.ids, userId]);
                }
            }}
            style={{
                flexDirection: "row",
                backgroundColor: hasReacted ? "#543596" : "#321E5D",
                borderStyle: "solid",
                borderColor: hasReacted ? "#854dff" : "#321E5D",
                borderWidth: 1.4,
                borderRadius: 12,
                paddingHorizontal: 9,
                paddingVertical: 5,
                gap: 6,
                alignSelf: "flex-start",
            }}>
            <View style={{ flexDirection: "row", gap: 6 }}>
                <ThemedText style={[styles.text, styles.textFlexBox]} type="default">
                    {reaction?.emoji}
                </ThemedText>
                <ThemedText style={[styles.text, styles.textFlexBox]} type="default">
                    {reaction?.count}
                </ThemedText>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    textFlexBox: {
        height: 23,
        justifyContent: "center",
        alignItems: "center",
        display: "flex",
        textAlign: "center",
    },
    text: {
        fontSize: 16,
        color: "#FFFFFF",
    },
});

export default ReactPills;

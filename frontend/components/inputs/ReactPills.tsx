import * as React from "react";
import { useState } from "react";
import { Text, StyleSheet, View, TouchableOpacity } from "react-native";
import { ThemedText } from "../ThemedText";
import { SlackReaction } from "../cards/PostCard";
import { useThemeColor } from "@/hooks/useThemeColor";

type Props = {
    postId: number;
    reaction: SlackReaction;
    onAddReaction: (emoji: string, count: number, ids: string[]) => void;
    onRemoveReaction: (emoji: string, count: number, ids: string[]) => void;
};

const ReactPills = ({ reaction, onAddReaction, onRemoveReaction }: Props) => {
    const userId = "67ba5abb616b5e6544e0137b";
    const ThemedColor = useThemeColor();

    const getHasReacted = (reaction: SlackReaction, userId: string) => {
        if (!reaction || !reaction.ids) return false;
        const idsSet = new Set(reaction.ids ?? []);
        return idsSet.has(userId);
    };

    const [hasReacted, setHasReacted] = useState(getHasReacted(reaction, userId));

    if (reaction?.count === 0 && !hasReacted) {
        return null;
    }

    const styles = stylesheet(ThemedColor);

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
            style={[
                styles.pill,
                {
                    backgroundColor: hasReacted ? "#543596" : "#3f1d4c",
                    borderColor: hasReacted ? "#854dff" : "#3f1d4c",
                },
            ]}>
            <View style={styles.pillContent}>
                <ThemedText style={styles.emoji}>{reaction?.emoji}</ThemedText>
                <ThemedText style={styles.count}>{reaction?.count}</ThemedText>
            </View>
        </TouchableOpacity>
    );
};

const stylesheet = (ThemedColor: any) =>
    StyleSheet.create({
        pill: {
            flexDirection: "row",
            borderStyle: "solid",
            borderWidth: 1.4,
            borderRadius: 23,
            paddingHorizontal: 9,
            paddingVertical: 4,
            alignSelf: "flex-start",
        },
        pillContent: {
            flexDirection: "row",
            gap: 6,
            alignItems: "center",
        },
        emoji: {
            fontSize: 20,
            color: ThemedColor.buttonText,
            textAlign: "center",
            lineHeight: 21,
        },
        count: {
            fontSize: 15,
            color: ThemedColor.buttonText,
            textAlign: "center",
            lineHeight: 21,
            minWidth: 6,
        },
    });

export default ReactPills;

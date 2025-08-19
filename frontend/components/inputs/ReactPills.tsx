import * as React from "react";
import { useState } from "react";
import { Text, StyleSheet, View, TouchableOpacity } from "react-native";
import { ThemedText } from "../ThemedText";
import { SlackReaction } from "../cards/PostCard";
import { useThemeColor } from "@/hooks/useThemeColor";

type Props = {
    postId: number;
    reaction: SlackReaction;
    isHighlighted?: boolean;
    onPress: () => void;
};

const ReactPills = ({ reaction, isHighlighted = false, onPress }: Props) => {
    const ThemedColor = useThemeColor();
    const styles = stylesheet(ThemedColor, isHighlighted);

    return (
        <TouchableOpacity
            onPress={onPress}
            style={[
                styles.pill,
                {
                    backgroundColor: isHighlighted ? "#543596" : "#3f1d4c",
                    borderColor: isHighlighted ? "#854dff" : "#3f1d4c",
                },
            ]}
            activeOpacity={0.7}>
            <View style={styles.pillContent}>
                <ThemedText style={[styles.emoji, { color: isHighlighted ? "#ffffff" : ThemedColor.buttonText }]}>
                    {reaction?.emoji}
                </ThemedText>
                {reaction?.count > 0 && (
                    <ThemedText style={[styles.count, { color: isHighlighted ? "#ffffff" : ThemedColor.buttonText }]}>
                        {reaction.count}
                    </ThemedText>
                )}
            </View>
        </TouchableOpacity>
    );
};

const stylesheet = (ThemedColor: any, isHighlighted: boolean) =>
    StyleSheet.create({
        pill: {
            flexDirection: "row",
            borderStyle: "solid",
            borderWidth: 1.4,
            borderRadius: 23,
            paddingHorizontal: 9,
            paddingVertical: 4,
            alignSelf: "flex-start",
            opacity: 1,
        },
        pillContent: {
            flexDirection: "row",
            gap: 6,
            alignItems: "center",
            justifyContent: "center",
        },
        emoji: {
            fontSize: 20,
            textAlign: "center",
            lineHeight: 27,
        },
        count: {
            fontSize: 15,
            textAlign: "center",
            lineHeight: 21,
            minWidth: 6,
            fontWeight: "600",
        },
    });

export default ReactPills;

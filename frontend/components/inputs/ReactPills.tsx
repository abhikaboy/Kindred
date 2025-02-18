import * as React from "react";
import { useState } from "react";
import { Text, StyleSheet, View, TouchableOpacity } from "react-native";
import { ThemedText } from "../ThemedText";

type Props = {
    reacted: boolean;
    emoji: string;
    count: number;
};

const ReactPills = ({ reacted, emoji, count }: Props) => {
    const [hasReacted, setHasReacted] = useState(reacted);

    return (
        <TouchableOpacity
            onPress={() => {
                setHasReacted(!hasReacted);
            }}
            style={{
                flexDirection: "row",
                backgroundColor: hasReacted ? "#543596" : "#321E5D",
                borderStyle: "solid",
                borderColor: hasReacted ? "#854dff" : "#321E5D",
                borderWidth: 1.4,
                borderRadius: 23,
                paddingHorizontal: 9,
                paddingVertical: 5,
                gap: 6,
                alignSelf: "flex-start",
            }}>
            <View style={{ flexDirection: "row", gap: 6 }}>
                <ThemedText style={[styles.text, styles.textFlexBox]} type="default">
                    {emoji}
                </ThemedText>
                <ThemedText style={[styles.text, styles.textFlexBox]} type="default">
                    {hasReacted ? count + 1 : count}
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

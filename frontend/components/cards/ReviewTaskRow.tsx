import React from "react";
import { View, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";

type Props = {
    label: string;
    value: string | number;
    empty?: boolean;
    numberOfLines?: number;
    rightContent?: React.ReactNode;
};

const ReviewTaskRow = ({ label, value, empty = false, numberOfLines, rightContent }: Props) => {
    const ThemedColor = useThemeColor();
    const disabled = 0.25;
    return (
        <View style={[styles.row, { borderBottomColor: ThemedColor.tertiary }]}>
            <ThemedText
                type="default"
                style={[styles.label, { opacity: empty ? disabled : 1, color: ThemedColor.caption }]}
            >
                {label}
            </ThemedText>
            {rightContent ?? (
                <ThemedText
                    type="default"
                    numberOfLines={numberOfLines}
                    ellipsizeMode="tail"
                    style={[styles.value, { opacity: empty ? disabled : 1 }]}
                >
                    {value}
                </ThemedText>
            )}
        </View>
    );
};

export default ReviewTaskRow;

const styles = StyleSheet.create({
    row: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        gap: 12,
    },
    label: {
        width: 72,
        flexShrink: 0,
        fontSize: 13,
    },
    value: {
        flex: 1,
        fontSize: 15,
    },
});

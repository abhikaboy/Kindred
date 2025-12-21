import React from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";

type Props = {
    label: string;
    value: string | number;
    empty?: boolean;
};

const ReviewTaskRow = ({ label, value, empty = false }: Props) => {
    const ThemedColor = useThemeColor();
    const disabled = 0.2
    return (
        <View style={[styles.row, { borderBottomColor: ThemedColor.tertiary }]}>
            <ThemedText type="default" style={{width:Dimensions.get("screen").width * 0.3, opacity: empty ? disabled : 1}}>{label}: </ThemedText>
            <ThemedText type="default" style={{ opacity: empty ? disabled : 1 }}>{value}</ThemedText>
        </View>
    );
};

export default ReviewTaskRow;

const styles = StyleSheet.create({
    row: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
});


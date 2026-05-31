import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { getCategoryDuotoneColors } from "@/utils/categoryColors";

interface TagChipProps {
    tag: string;
    onPress?: (tag: string) => void;
}

export default function TagChip({ tag, onPress }: TagChipProps) {
    const { primary, light } = getCategoryDuotoneColors(undefined, tag);

    const content = (
        <View style={[styles.chip, { backgroundColor: light }]}>
            <ThemedText type="caption" style={{ color: primary }}>
                {tag}
            </ThemedText>
        </View>
    );

    if (!onPress) return content;

    return (
        <TouchableOpacity onPress={() => onPress(tag)} accessibilityRole="button">
            {content}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 4,
        borderRadius: 999,
    },
});

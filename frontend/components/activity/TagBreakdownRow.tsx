import React from "react";
import { ScrollView, StyleSheet, TouchableOpacity, useColorScheme, View } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { getCategoryDuotoneColors } from "@/utils/categoryColors";
import type { TagAggregate } from "@/utils/tagBreakdown";

interface TagBreakdownRowProps {
    tags: TagAggregate[]; // pre-sorted by the parent
    selectedTags: string[];
    onToggle: (tag: string) => void;
}

export default function TagBreakdownRow({
    tags,
    selectedTags,
    onToggle,
}: TagBreakdownRowProps) {
    const scheme = useColorScheme() ?? "light";

    if (tags.length === 0) return null;

    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.row}
        >
            {tags.map(({ tag, count }) => {
                const { primary, light, background } = getCategoryDuotoneColors(undefined, tag, scheme);
                const isSelected = selectedTags.includes(tag);
                return (
                    <TouchableOpacity
                        key={tag}
                        onPress={() => onToggle(tag)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                    >
                        <View
                            style={[
                                styles.chip,
                                { backgroundColor: isSelected ? primary : background },
                            ]}
                        >
                            <ThemedText
                                type="caption"
                                style={{ color: isSelected ? light : primary }}
                            >
                                {`${tag} · ${count}`}
                            </ThemedText>
                        </View>
                    </TouchableOpacity>
                );
            })}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: "row",
        gap: 8,
        paddingVertical: 4,
    },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 4,
        borderRadius: 999,
    },
});

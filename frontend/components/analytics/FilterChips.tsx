import React from "react";
import { ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "@/components/ThemedText";

interface CategoryChip {
    id: string;
    name: string;
}

interface Props {
    categories: CategoryChip[];
    selected?: string;
    onSelect: (categoryId?: string) => void;
}

export function FilterChips({ categories, selected, onSelect }: Props) {
    return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            <Chip label="All" active={!selected} onPress={() => onSelect(undefined)} />
            {categories.map((c) => (
                <Chip key={c.id} label={c.name} active={selected === c.id} onPress={() => onSelect(c.id)} />
            ))}
        </ScrollView>
    );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
    const ThemedColor = useThemeColor() as any;
    return (
        <TouchableOpacity
            activeOpacity={0.7}
            onPress={onPress}
            style={[
                styles.chip,
                {
                    backgroundColor: active ? ThemedColor.primary : ThemedColor.lightened,
                    borderColor: active ? ThemedColor.primary : ThemedColor.tertiary,
                },
            ]}>
            <ThemedText type={active ? "defaultSemiBold" : "default"} style={{ color: active ? ThemedColor.buttonText : ThemedColor.text, fontSize: 13 }}>
                {label}
            </ThemedText>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    row: {
        gap: 8,
        paddingVertical: 4,
        paddingRight: 16,
    },
    chip: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 999,
        borderWidth: 1,
    },
});

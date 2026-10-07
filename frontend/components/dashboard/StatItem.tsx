import React from "react";
import { TouchableOpacity, StyleSheet, Dimensions } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";

const base = 393;
const scale = Dimensions.get("screen").width / base;

interface StatItemProps {
    value: number;
    label: string;
    isSelected: boolean;
    isDimmed: boolean;
    onPress: () => void;
    isLoading?: boolean;
    align?: "left" | "center" | "right";
}

const alignMap = {
    left: "flex-start",
    center: "center",
    right: "flex-end",
} as const;

const StatItem: React.FC<StatItemProps> = ({ value, label, isSelected, isDimmed, onPress, isLoading, align = "center" }) => {
    const ThemedColor = useThemeColor();

    return (
        <TouchableOpacity
            style={[styles.container, { alignItems: alignMap[align] }, isDimmed && styles.dimmed]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <ThemedText
                type={isSelected ? "defaultSemiBold" : "caption"}
                style={[
                    styles.label,
                    isSelected && { color: ThemedColor.primary },
                ]}
            >
                {label} {isSelected ? "▾" : "▸"}
            </ThemedText>
            <ThemedText type="defaultSemiBold"
                style={[styles.number, { color: ThemedColor.header }]}
            >
                {isLoading ? "—" : value}
            </ThemedText>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        gap: 2,
    },
    dimmed: {
        opacity: 0.4,
    },
    number: {
        fontSize: 36 * scale,
        lineHeight: 40 * scale,
    },
    label: {
        fontSize: 11 * scale,
    },
});

export default StatItem;

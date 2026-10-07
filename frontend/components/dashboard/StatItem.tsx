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
                type="caption"
                style={[
                    styles.label,
                    isSelected && { color: ThemedColor.primary, fontWeight: "600" },
                ]}
            >
                {label} {isSelected ? "▾" : "▸"}
            </ThemedText>
            <ThemedText
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
        fontFamily: "Outfit",
        fontSize: 36 * scale,
        fontWeight: "600",
        lineHeight: 40 * scale,
    },
    label: {
        textTransform: "uppercase",
        letterSpacing: 0.5,
        fontSize: 11 * scale,
    },
});

export default StatItem;

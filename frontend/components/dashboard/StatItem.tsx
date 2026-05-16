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
}

const StatItem: React.FC<StatItemProps> = ({ value, label, isSelected, isDimmed, onPress, isLoading }) => {
    const ThemedColor = useThemeColor();

    return (
        <TouchableOpacity
            style={[styles.container, isDimmed && styles.dimmed]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <ThemedText
                style={[styles.number, { color: ThemedColor.header }]}
            >
                {isLoading ? "—" : value}
            </ThemedText>
            <ThemedText
                type="caption"
                style={[
                    styles.label,
                    isSelected && { color: ThemedColor.primary, fontWeight: "600" },
                ]}
            >
                {label} {isSelected ? "‹" : "›"}
            </ThemedText>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: "center",
        flex: 1,
    },
    dimmed: {
        opacity: 0.4,
    },
    number: {
        fontFamily: "Fraunces",
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

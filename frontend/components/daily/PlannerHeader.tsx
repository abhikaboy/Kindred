import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { CaretLeft, CaretRight } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";

type Props = {
    anchorDate: Date;
    mode: "week" | "month";
    onStep: (delta: 1 | -1) => void;
    onModeChange: (mode: "week" | "month") => void;
    onBack?: () => void;
};

const PlannerHeader = ({ anchorDate, mode, onStep, onModeChange, onBack }: Props) => {
    const ThemedColor = useThemeColor();
    const label = anchorDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

    return (
        <View style={styles.row}>
            {onBack && (
                <TouchableOpacity
                    onPress={onBack}
                    style={[styles.backButton, { backgroundColor: ThemedColor.lightened }]}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Go back"
                >
                    <CaretLeft size={20} color={ThemedColor.text} weight="bold" />
                </TouchableOpacity>
            )}
            <ThemedText type="fancyFrauncesSubheading" style={{ flex: 1 }}>
                {label}
            </ThemedText>
            <TouchableOpacity onPress={() => onStep(-1)} hitSlop={10} style={styles.stepButton}>
                <CaretLeft size={16} color={ThemedColor.caption} weight="bold" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onStep(1)} hitSlop={10} style={styles.stepButton}>
                <CaretRight size={16} color={ThemedColor.caption} weight="bold" />
            </TouchableOpacity>
            {/* Single flip button labeled with the mode it switches to */}
            <TouchableOpacity
                onPress={() => onModeChange(mode === "week" ? "month" : "week")}
                style={[styles.modeButton, { backgroundColor: ThemedColor.lightened }]}
                hitSlop={6}
            >
                <ThemedText type="caption">{mode === "week" ? "Month" : "Week"}</ThemedText>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    row: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: HORIZONTAL_PADDING,
        paddingVertical: 8,
        gap: 12,
    },
    stepButton: { padding: 4 },
    modeButton: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 16,
        marginLeft: 4,
    },
    backButton: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 10,
    },
});

export default PlannerHeader;

import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { CaretLeft, CaretRight } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import SegmentedControl from "@/components/ui/SegmentedControl";
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
            <View style={styles.stepper}>
                <TouchableOpacity onPress={() => onStep(-1)} hitSlop={8}>
                    <CaretLeft size={18} color={ThemedColor.primary} weight="bold" />
                </TouchableOpacity>
                <ThemedText type="fancyFrauncesSubheading">{label}</ThemedText>
                <TouchableOpacity onPress={() => onStep(1)} hitSlop={8}>
                    <CaretRight size={18} color={ThemedColor.primary} weight="bold" />
                </TouchableOpacity>
            </View>
            <View style={styles.segment}>
                <SegmentedControl
                    options={["Week", "Month"]}
                    selectedOption={mode === "week" ? "Week" : "Month"}
                    onOptionPress={(o) => onModeChange(o === "Week" ? "week" : "month")}
                    size="small"
                />
            </View>
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
    stepper: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
    segment: { width: 150 },
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

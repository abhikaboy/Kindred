import React from "react";
import { StyleSheet, View } from "react-native";
import { IconProps } from "phosphor-react-native";
import { ThemedText } from "../ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";

export type TaskChipTone = "neutral" | "overdue" | "active";

interface Props {
    label?: string;
    tone?: TaskChipTone;
    Icon?: React.ComponentType<IconProps>;
}

const TaskChip = ({ label, tone = "neutral", Icon }: Props) => {
    const ThemedColor = useThemeColor();
    const color =
        tone === "overdue" ? ThemedColor.error : tone === "active" ? ThemedColor.primary : ThemedColor.caption;

    return (
        <View style={[styles.chip, { backgroundColor: ThemedColor.lightened }]}>
            {Icon && <Icon size={12} color={color} weight="regular" />}
            {label ? (
                <ThemedText type="caption" style={{ color, fontSize: 12.5, lineHeight: 16, letterSpacing: 0.1 }}>
                    {label}
                </ThemedText>
            ) : null}
        </View>
    );
};

export default TaskChip;

const styles = StyleSheet.create({
    chip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 999,
    },
});

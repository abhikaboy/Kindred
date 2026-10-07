import React from "react";
import { TouchableOpacity, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { PathIcon as Path } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { openPlanSheet } from "@/hooks/planSheetStore";
import type { Task } from "@/api/types";

type Props = { task: Task; several?: boolean };

/** One quiet invitation under the date; never a count of what's waiting. */
const WaitingChip = ({ task, several }: Props) => {
    const ThemedColor = useThemeColor();
    const label = several ? "A few things waiting on a path" : "1 thing waiting on a path";
    return (
        <TouchableOpacity
            onPress={() => {
                Haptics.selectionAsync();
                openPlanSheet({ task });
            }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={label}
            style={[styles.chip, { backgroundColor: ThemedColor.lightened }]}
        >
            <Path size={16} color={ThemedColor.primary} weight="regular" />
            <ThemedText type="smallerDefault">
                {label}
            </ThemedText>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    chip: {
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        height: 40,
        paddingHorizontal: 16,
        borderRadius: 999,
    },
});

export default WaitingChip;

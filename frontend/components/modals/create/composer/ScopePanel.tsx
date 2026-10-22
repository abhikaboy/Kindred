import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/ThemedText";
import { SectionTitle } from "@/components/dashboard/SectionHeader";
import { STAGE } from "@/components/capture/CaptureStage";

export type EditScope = "one" | "all";

type Props = {
    onPick: (scope: EditScope) => void;
    onCancel: () => void;
};

const OPTIONS: { key: EditScope; title: string; detail: string }[] = [
    { key: "one", title: "Only this task", detail: "The rest of the series keeps the old plan" },
    { key: "all", title: "All future tasks", detail: "Every occurrence gets these changes" },
];

/** Where a recurring edit applies, asked on the stage like the date panel. */
const ScopePanel = ({ onPick, onCancel }: Props) => (
    <View style={styles.container}>
        <View style={styles.header}>
            <SectionTitle title="Update recurring task" style={{ color: STAGE.text }} />
            <TouchableOpacity onPress={onCancel} hitSlop={8} accessibilityRole="button">
                <ThemedText type="lightBody" style={{ color: STAGE.muted }}>
                    Cancel
                </ThemedText>
            </TouchableOpacity>
        </View>
        <View style={styles.options}>
            {OPTIONS.map((o) => (
                <TouchableOpacity
                    key={o.key}
                    onPress={() => {
                        Haptics.selectionAsync();
                        onPick(o.key);
                    }}
                    style={styles.option}
                    accessibilityRole="button"
                    accessibilityLabel={o.title}>
                    <ThemedText type="defaultSemiBold" style={{ color: STAGE.text }}>
                        {o.title}
                    </ThemedText>
                    <ThemedText type="caption" style={{ color: STAGE.muted }}>
                        {o.detail}
                    </ThemedText>
                </TouchableOpacity>
            ))}
        </View>
    </View>
);

export default ScopePanel;

const styles = StyleSheet.create({
    container: { gap: 16, alignSelf: "stretch" },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    options: { gap: 8 },
    option: { gap: 2, borderRadius: 12, backgroundColor: STAGE.fill, paddingHorizontal: 12, paddingVertical: 10 },
});

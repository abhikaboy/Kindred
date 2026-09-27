import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import {
    AmazonLogo,
    ChatsCircle,
    CompassTool,
    EnvelopeSimple,
    GoogleChromeLogo,
    LinkedinLogo,
    SlackLogo,
    type IconProps,
} from "phosphor-react-native";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/ThemedText";
import { SectionTitle } from "@/components/dashboard/SectionHeader";
import { STAGE } from "@/components/capture/CaptureStage";
import { useTaskCreation } from "@/contexts/taskCreationContext";

// Same set as the old sheet's screen
const APPS: { id: string; name: string; Icon: React.ComponentType<IconProps>; weight: IconProps["weight"] }[] = [
    { id: "amazon", name: "Amazon", Icon: AmazonLogo, weight: "regular" },
    { id: "gmail", name: "Gmail", Icon: EnvelopeSimple, weight: "regular" },
    { id: "outlook", name: "Outlook", Icon: EnvelopeSimple, weight: "fill" },
    { id: "imessage", name: "iMessage", Icon: ChatsCircle, weight: "fill" },
    { id: "slack", name: "Slack", Icon: SlackLogo, weight: "fill" },
    { id: "linkedin", name: "LinkedIn", Icon: LinkedinLogo, weight: "fill" },
    { id: "chrome", name: "Chrome", Icon: GoogleChromeLogo, weight: "fill" },
    { id: "safari", name: "Safari", Icon: CompassTool, weight: "regular" },
];

/**
 * Integration picker on the stage: a two-column grid of app tiles. Picking one
 * sets it and closes; picking the current one again removes it.
 */
const IntegrationPanel = ({ onDone }: { onDone: () => void }) => {
    const { integration, setIntegration } = useTaskCreation();

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <SectionTitle title="Integration" style={{ color: STAGE.text }} />
                <TouchableOpacity onPress={onDone} hitSlop={8} accessibilityRole="button">
                    <ThemedText type="defaultSemiBold" style={{ color: STAGE.text }}>
                        Done
                    </ThemedText>
                </TouchableOpacity>
            </View>
            <ThemedText type="caption" style={{ color: STAGE.muted, marginTop: -8 }}>
                Choose an app to integrate with this task
            </ThemedText>
            <View style={styles.grid}>
                {APPS.map(({ id, name, Icon, weight }) => {
                    const selected = integration === id;
                    return (
                        <TouchableOpacity
                            key={id}
                            onPress={() => {
                                Haptics.selectionAsync();
                                setIntegration(selected ? "" : id);
                                if (!selected) onDone();
                            }}
                            style={[styles.tile, { backgroundColor: selected ? STAGE.selected : STAGE.fill }]}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}>
                            <Icon size={24} color={selected ? STAGE.onSelected : STAGE.text} weight={weight} />
                            <ThemedText type="lightBody" style={{ color: selected ? STAGE.onSelected : STAGE.text }}>
                                {name}
                            </ThemedText>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
};

export default IntegrationPanel;

const styles = StyleSheet.create({
    container: { gap: 16 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    // Two per row: half the width less half the gap
    tile: {
        flexBasis: "48%",
        flexGrow: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        height: 56,
        paddingHorizontal: 16,
        borderRadius: 12,
    },
});

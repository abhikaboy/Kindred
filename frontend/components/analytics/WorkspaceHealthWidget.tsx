import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "@/components/ThemedText";
import { AnalyticsWorkspaceHealth, AnalyticsWorkspaceHealthRow } from "@/api/analytics";
import { WidgetCard } from "./WidgetCard";
import { StatusPill } from "./StatusPill";

interface Props {
    workspaceHealth: AnalyticsWorkspaceHealth;
    onSelectWorkspace?: (workspace: string) => void;
}

export function WorkspaceHealthWidget({ workspaceHealth, onSelectWorkspace }: Props) {
    const ThemedColor = useThemeColor() as any;
    const styles = stylesheet(ThemedColor);

    const rows = workspaceHealth.rows ?? [];
    if (rows.length === 0) {
        return (
            <WidgetCard title="Workspace health">
                <ThemedText type="caption">No workspace activity in this period yet.</ThemedText>
            </WidgetCard>
        );
    }

    return (
        <WidgetCard title="Workspace health">
            <View style={styles.list}>
                {rows.map((row) => (
                    <WorkspaceHealthRowItem key={row.workspace} row={row} onSelectWorkspace={onSelectWorkspace} />
                ))}
            </View>
        </WidgetCard>
    );
}

function WorkspaceHealthRowItem({
    row,
    onSelectWorkspace,
}: {
    row: AnalyticsWorkspaceHealthRow;
    onSelectWorkspace?: (workspace: string) => void;
}) {
    const ThemedColor = useThemeColor() as any;
    const styles = stylesheet(ThemedColor);
    return (
        <TouchableOpacity
            style={styles.row}
            activeOpacity={0.6}
            disabled={!onSelectWorkspace}
            onPress={() => onSelectWorkspace?.(row.workspace)}>
            <View style={styles.nameCol}>
                <ThemedText type="defaultSemiBold" style={styles.name}>
                    {row.workspace}
                </ThemedText>
                <ThemedText type="caption">{row.done} done · {row.onTimePct}% on time · {row.kudos} Kudos</ThemedText>
            </View>
            <StatusPill status={row.status} />
        </TouchableOpacity>
    );
}

const stylesheet = (ThemedColor: any) =>
    StyleSheet.create({
        list: {
            gap: 14,
        },
        row: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
        },
        nameCol: {
            flexShrink: 1,
            gap: 2,
        },
        name: {
            fontSize: 15,
        },
    });

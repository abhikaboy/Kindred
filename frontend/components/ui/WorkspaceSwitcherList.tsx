import React from "react";
import { TouchableOpacity, View, StyleSheet } from "react-native";
import * as PhosphorIcons from "phosphor-react-native";
import { CalendarBlank } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import type { Workspace } from "@/api/types";

type Props = {
    workspaces: Workspace[];
    selected: string;
    onSelectCalendar: () => void;
    onSelectWorkspace: (name: string) => void;
};

const activeTaskCount = (workspace: Workspace) =>
    workspace.categories.reduce(
        (total, category) =>
            total + (category.tasks?.filter((task) => task.active !== false).length || 0),
        0
    );

// Glassy list shown above the pencil tab: Calendar pinned on top, then every
// non-blueprint workspace. Pure/presentational — navigation is wired by the parent.
export function WorkspaceSwitcherList({ workspaces, selected, onSelectCalendar, onSelectWorkspace }: Props) {
    const ThemedColor = useThemeColor();

    return (
        <View>
            <SwitcherRow
                label="Calendar"
                icon={<CalendarBlank size={18} color="#FFFFFF" weight="fill" />}
                onPress={onSelectCalendar}
                tint={ThemedColor.primary}
            />
            <View style={[styles.divider, { backgroundColor: ThemedColor.tertiary }]} />
            {workspaces
                .filter((workspace) => !workspace.isBlueprint)
                .map((workspace) => {
                    const IconComponent = workspace.icon
                        ? ((PhosphorIcons as any)[workspace.icon] as
                              | React.ComponentType<{ size?: number; color?: string; weight?: string }>
                              | undefined)
                        : undefined;
                    const iconColor = workspace.color ?? ThemedColor.primary;
                    return (
                        <SwitcherRow
                            key={workspace.name}
                            label={workspace.name}
                            count={activeTaskCount(workspace)}
                            selected={selected === workspace.name}
                            icon={
                                IconComponent ? (
                                    <IconComponent size={18} color={iconColor} weight="regular" />
                                ) : (
                                    <PhosphorIcons.SquaresFour size={18} color={ThemedColor.caption} weight="regular" />
                                )
                            }
                            onPress={() => onSelectWorkspace(workspace.name)}
                        />
                    );
                })}
        </View>
    );
}

type RowProps = {
    label: string;
    icon: React.ReactNode;
    onPress: () => void;
    count?: number;
    selected?: boolean;
    tint?: string;
};

function SwitcherRow({ label, icon, onPress, count, selected, tint }: RowProps) {
    const ThemedColor = useThemeColor();
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            style={[
                styles.row,
                tint ? { backgroundColor: tint } : selected ? { backgroundColor: ThemedColor.tertiary } : undefined,
            ]}>
            <View style={styles.iconWrap}>{icon}</View>
            <ThemedText
                type="default"
                numberOfLines={1}
                style={[styles.label, tint ? { color: "#FFFFFF", fontWeight: "600" } : undefined]}>
                {label}
            </ThemedText>
            {count !== undefined && (
                <ThemedText type="default" style={{ color: tint ? "#FFFFFF" : ThemedColor.caption }}>
                    {count}
                </ThemedText>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
    },
    iconWrap: {
        width: 22,
        alignItems: "center",
    },
    label: {
        flex: 1,
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        marginVertical: 4,
        marginHorizontal: 6,
    },
});

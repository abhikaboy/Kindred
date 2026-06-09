import React from "react";
import { View, TouchableOpacity, StyleProp, ViewStyle } from "react-native";
import * as PhosphorIcons from "phosphor-react-native";
import Feather from "@expo/vector-icons/Feather";
import { ThemedText } from "../ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";

type Props = {
    title: string;
    selected: string;
    onPress: () => void;
    onLongPress?: () => void;
    taskCount?: number;
    workspaceIcon?: string;
    workspaceColor?: string;
    style?: StyleProp<ViewStyle>;
};

export const WorkspaceDrawerItem = (props: Props) => {
    const ThemedColor = useThemeColor();
    const isSelected = props.selected === props.title;
    const accentColor = props.workspaceColor ?? ThemedColor.tertiary;

    const IconComponent = props.workspaceIcon
        ? ((PhosphorIcons as any)[props.workspaceIcon] as React.ComponentType<{ size?: number; color?: string; weight?: string }> | undefined)
        : undefined;

    return (
        <TouchableOpacity
            style={[
                {
                    flexDirection: "row",
                    alignItems: "center",
                    width: "100%",
                    paddingVertical: 12,
                    paddingHorizontal: HORIZONTAL_PADDING,
                    gap: 8,
                },
                isSelected ? { backgroundColor: ThemedColor.tertiary } : undefined,
                props.style,
            ]}
            onPress={props.onPress}
            onLongPress={props.onLongPress}>
            {/* Full-height accent so consecutive rows form one connected rail. */}
            <View style={{ position: "absolute", left: 20, top: 0, bottom: 0, width: 3, backgroundColor: accentColor }} />
            {/* Fixed-width icon column so text aligns with the other drawer items. */}
            <View style={{ width: 24, marginLeft: 12, alignItems: "center" }}>
                {IconComponent ? (
                    <IconComponent size={18} color={props.workspaceColor ?? ThemedColor.primary} weight="regular" />
                ) : (
                    <Feather name="grid" size={16} color={ThemedColor.caption} />
                )}
            </View>
            <ThemedText type="default" style={{ flexShrink: 1, fontWeight: "600" }} numberOfLines={2}>
                {props.title}
            </ThemedText>
            {props.taskCount !== undefined && (
                <ThemedText type="default" style={{ color: ThemedColor.caption, marginLeft: "auto", flexShrink: 0 }}>
                    {props.taskCount}
                </ThemedText>
            )}
        </TouchableOpacity>
    );
};

export default WorkspaceDrawerItem;

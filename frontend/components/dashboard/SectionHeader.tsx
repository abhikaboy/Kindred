import React from "react";
import { View, TouchableOpacity } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Eye, EyeSlash } from "phosphor-react-native";
import { useThemeColor } from "@/hooks/useThemeColor";

interface SectionHeaderProps {
    title: string;
    visible: boolean;
    onToggleVisibility: () => void;
    /** Optional extra element rendered between the title and the eye icon */
    right?: React.ReactNode;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ title, visible, onToggleVisibility, right }) => {
    const ThemedColor = useThemeColor();

    return (
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <ThemedText type="caption">{title}</ThemedText>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                {right}
                <TouchableOpacity onPress={onToggleVisibility} hitSlop={8}>
                    {visible
                        ? <Eye size={16} weight="regular" color={ThemedColor.caption + "40"} />
                        : <EyeSlash size={16} weight="regular" color={ThemedColor.caption + "40"} />}
                </TouchableOpacity>
            </View>
        </View>
    );
};

export default SectionHeader;

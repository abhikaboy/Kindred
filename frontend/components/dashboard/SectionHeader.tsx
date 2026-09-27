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
    /** "prominent" renders a body-size sentence-case title instead of the small caption */
    variant?: "caption" | "prominent";
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ title, visible, onToggleVisibility, right, variant = "caption" }) => {
    const ThemedColor = useThemeColor();
    return (
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            {variant === "prominent"
                ? <ThemedText type="default" style={{ fontSize: 17 }}>{title}</ThemedText>
                : <ThemedText type="caption" style={{ letterSpacing: 0.5 }}>{title}</ThemedText>}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                {right}
                <TouchableOpacity onPress={onToggleVisibility} hitSlop={8} style={{ opacity: 0.35 }}>
                    {visible
                        ? <Eye size={16} weight="regular" color={ThemedColor.caption} />
                        : <EyeSlash size={16} weight="regular" color={ThemedColor.caption} />}
                </TouchableOpacity>
            </View>
        </View>
    );
};

export default SectionHeader;

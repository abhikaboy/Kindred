import { TouchableOpacity, View } from "react-native";
import React from "react";
import { ThemedText } from "@/components/ThemedText";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Screen } from "../CreateModal";
import { useThemeColor } from "@/hooks/useThemeColor";
type Props = {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    screen: Screen;
    goTo: (screen: Screen) => void;
    showUnconfigured?: boolean;
    configured?: boolean;
};

const AdvancedOption = ({ icon, label, screen, goTo, showUnconfigured, configured }: Props) => {
    const ThemedColor = useThemeColor();
    // if we should only show configured and we are NOT configured then dont show
    if (!showUnconfigured && !configured) {
        return null;
    }
    // if we should show unconfigured and we are configured then dont show
    if (showUnconfigured && configured) {
        return null;
    }
    return (
        <TouchableOpacity
            onPress={() => goTo(screen)}
            style={{
                flexDirection: "row",
                gap: 8,
                alignItems: "center",
                backgroundColor: ThemedColor.lightened,
                padding: 16,
                borderRadius: 12,
                // borderWidth: 1,
                // borderColor: ThemedColor.tertiary,
            }}>
            <Ionicons name={icon} size={24} color={ThemedColor.text} />
            <ThemedText type="lightBody">{label}</ThemedText>
        </TouchableOpacity>
    );
};

export default AdvancedOption;

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
};

const AdvancedOption = ({ icon, label, screen, goTo }: Props) => {
    const ThemedColor = useThemeColor();
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

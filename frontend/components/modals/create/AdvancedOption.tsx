import { TouchableOpacity, View } from "react-native";
import React from "react";
import { ThemedText } from "@/components/ThemedText";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Screen } from "../CreateModal";

type Props = {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    screen: Screen;
    goTo: (screen: Screen) => void;
};

const AdvancedOption = ({ icon, label, screen, goTo }: Props) => {
    return (
        <TouchableOpacity onPress={() => goTo(screen)} style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <Ionicons name={icon} size={24} color="white" />
            <ThemedText type="lightBody">{label}</ThemedText>
        </TouchableOpacity>
    );
};

export default AdvancedOption;

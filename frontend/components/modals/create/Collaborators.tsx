import { View } from "react-native";
import React from "react";
import { ThemedText } from "@/components/ThemedText";
import Feather from "@expo/vector-icons/Feather";
import { TouchableOpacity } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";

type Props = {
    goToStandard: () => void;
};

const Collaborators = ({ goToStandard }: Props) => {
    const ThemedColor = useThemeColor();

    return (
        <View style={{ gap: 24, display: "flex", flexDirection: "column" }}>
            <View style={{ display: "flex", flexDirection: "row", gap: 16 }}>
                <TouchableOpacity onPress={goToStandard}>
                    <Feather name="arrow-left" size={24} color={ThemedColor.text} />
                </TouchableOpacity>
                <ThemedText type="defaultSemiBold" style={{ textAlign: "center" }}>
                    Add Collaborators
                </ThemedText>
            </View>
            {/* Add collaborator search and selection here */}
        </View>
    );
};

export default Collaborators;

import { TouchableOpacity, View } from "react-native";
import React from "react";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";

type Props = {
    tag: string;
    onPress: () => void;
};

const SuggestedTag = ({ tag, onPress }: Props) => {
    const ThemedColor = useThemeColor();
    return (
        <TouchableOpacity
            activeOpacity={0.5}
            onPress={onPress}
            style={{
                display: "flex",
                flexDirection: "row",
                padding: 16,
                borderRadius: 12,
                backgroundColor: ThemedColor.primary + "10",
                borderWidth: 1,
                borderColor: ThemedColor.primary,
            }}>
            <ThemedText type="defaultSemiBold">{tag}</ThemedText>
        </TouchableOpacity>
    );
};

export default SuggestedTag;

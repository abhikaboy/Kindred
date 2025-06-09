import { TouchableOpacity, View } from "react-native";
import React from "react";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";

type Props = {
    tag: string;
    onPress: () => void;
    caption?: string;
};

const SuggestedTag = ({ tag, onPress, caption }: Props) => {
    const ThemedColor = useThemeColor();
    return (
        <TouchableOpacity
            activeOpacity={0.5}
            onPress={onPress}
            style={{
                display: "flex",
                flexDirection: "column",
                padding: 16,
                gap: 0,
                borderRadius: 12,
                backgroundColor: ThemedColor.primary + "10",
                borderWidth: 1,
                borderColor: ThemedColor.primary,
            }}>
            <ThemedText type="defaultSemiBold">{tag}</ThemedText>
            {caption && (
                <ThemedText type="subtitle_subtle" style={{ paddingVertical: 2 }}>
                    {caption}
                </ThemedText>
            )}
        </TouchableOpacity>
    );
};

export default SuggestedTag;

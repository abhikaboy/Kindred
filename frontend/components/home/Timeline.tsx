import React from "react";
import { View } from "react-native";
import { ThemedText } from "../ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";

export default function Timeline() {
    const ThemedColor = useThemeColor();
    return (
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            {[...Array(8)].map((_, index) => (
                <View key={index} style={{ alignItems: "flex-start", gap: 8 }}>
                    <View
                        style={{
                            width: 1,
                            height: 50,
                            backgroundColor: ThemedColor.disabled,
                        }}
                    />
                    <ThemedText
                        type="caption"
                        style={{
                            fontSize: 12,
                            transform: [{ translateX: -4 }],
                        }}>
                        {index + 1} PM
                    </ThemedText>
                </View>
            ))}
        </View>
    );
}

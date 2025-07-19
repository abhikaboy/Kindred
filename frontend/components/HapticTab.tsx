import { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { TouchableOpacity } from "react-native";
import * as Haptics from "expo-haptics";
import React from "react";
import { Platform } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";

export function HapticTab(props: BottomTabBarButtonProps) {
    const ThemedColor = useThemeColor();

    const handlePress = async () => {
        if (Platform.OS === "ios") {
            try {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch (error) {
                console.log("Haptic error:", error);
            }
        }
        props.onPress?.();
    };

    return (
        <TouchableOpacity
            {...props}
            onPress={handlePress}
            style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 12,
                backgroundColor: props.accessibilityState?.selected ? ThemedColor.tertiary + "80" : "transparent",
                borderRadius: 20,
                marginHorizontal: 4,
            }}
        />
    );
}

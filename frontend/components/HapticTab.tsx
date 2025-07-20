import { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { TouchableOpacity, View } from "react-native";
import * as Haptics from "expo-haptics";
import React from "react";
import { Platform } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";

export function HapticTab(props: BottomTabBarButtonProps & { isSelected?: boolean }) {
    const ThemedColor = useThemeColor();
    const isSelected = props.isSelected || false;

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
            onPress={handlePress}
            style={{
                flex: 1,
                backgroundColor: "transparent",
                borderRadius: 20,
                marginHorizontal: 4,
                paddingVertical: 12,
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
            }}>
            {isSelected && (
                <View
                    style={{
                        position: "absolute",
                        width: 6,
                        top: 44,
                        height: 6,
                        borderRadius: 4,
                        backgroundColor: "#854DFF",
                        alignSelf: "center",
                        zIndex: 1,
                    }}
                />
            )}

            <View
                style={{
                    alignItems: "center",
                    zIndex: 2,
                }}>
                {props.children}
            </View>
        </TouchableOpacity>
    );
}

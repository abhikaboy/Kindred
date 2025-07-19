import { useThemeColor } from "@/hooks/useThemeColor";
import { View } from "react-native";
import React from "react";

// This is a shim for web and Android where the tab bar is generally opaque.
export default undefined;

export function useBottomTabOverflow() {
    return 0;
}

// Ensure this component returns the correct background color for both themes
const TabBarBackground = () => {
    const ThemedColor = useThemeColor();

    return (
        <View
            style={{
                backgroundColor: ThemedColor.background,
                // Make sure this matches your theme background
            }}
        />
    );
};

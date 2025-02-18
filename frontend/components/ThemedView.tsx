import { Dimensions, View, type ViewProps } from "react-native";

import { useThemeColor } from "@/hooks/useThemeColor";
import React from "react";
import { Colors } from "@/constants/Colors";

export type ThemedViewProps = ViewProps & {
    lightColor?: string;
    darkColor?: string;
};

export function ThemedView({ style, lightColor, darkColor, ...otherProps }: ThemedViewProps) {
    return (
        <View
            style={[
                { backgroundColor: Colors.dark.background, minHeight: Dimensions.get("screen").height, flex: 1 },
                style,
            ]}
            {...otherProps}
        />
    );
}

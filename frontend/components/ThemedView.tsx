import { Dimensions, View, type ViewProps, ScrollView } from "react-native";

import { useThemeColor } from "@/hooks/useThemeColor";
import React from "react";
import ThemedColor from "@/constants/Colors";

export type ThemedViewProps = ViewProps & {
    lightColor?: string;
    darkColor?: string;
};

export function ThemedView({ style, lightColor, darkColor, ...otherProps }: ThemedViewProps) {
    return (
        <View
            style={[
                {
                    backgroundColor: ThemedColor.background,
                    flex: 1,
                    flexDirection: "column",
                    minHeight: Dimensions.get("screen").height,
                },
                style,
            ]}
            {...otherProps}
        />
    );
}

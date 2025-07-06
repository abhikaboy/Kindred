import { Dimensions, View, type ViewProps, ScrollView } from "react-native";

import { useThemeColor } from "@/hooks/useThemeColor";
import React from "react";

export type ThemedViewProps = ViewProps & {
    lightColor?: string;
    darkColor?: string;
    noFlex?: boolean;
};

export function ThemedView({ style, lightColor, darkColor, noFlex, ...otherProps }: ThemedViewProps) {
    let ThemedColor = useThemeColor();
    return (
        <View
            style={[
                {
                    backgroundColor: ThemedColor.background,
                    flex: noFlex ? 1 : 1,
                    flexDirection: "column",
                    minHeight: Dimensions.get("screen").height,
                },
                style,
            ]}
            {...otherProps}
        />
    );
}

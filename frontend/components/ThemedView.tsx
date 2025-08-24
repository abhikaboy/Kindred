import { Dimensions, View, type ViewProps, ScrollView, KeyboardAvoidingView } from "react-native";

import { useThemeColor } from "@/hooks/useThemeColor";
import React from "react";

export type ThemedViewProps = ViewProps & {
    lightColor?: string;
    darkColor?: string;
    noFlex?: boolean;
    keyboardAvoiding?: boolean
};

export function ThemedView({ style, lightColor, darkColor, noFlex, keyboardAvoiding, ...otherProps }: ThemedViewProps) {
    let ThemedColor = useThemeColor();
    if(keyboardAvoiding){
        return (<KeyboardAvoidingView
            behavior="padding"
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
        />)

    }
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

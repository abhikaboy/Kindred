import { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { PlatformPressable } from "@react-navigation/elements";
import * as Haptics from "expo-haptics";
import React from "react";

export function HapticTab(props: BottomTabBarButtonProps) {
    return (
        <PlatformPressable
            {...props}
            style={{
                zIndex: 30,
            }}
            onPressIn={async (ev) => {
                if (process.env.EXPO_OS === "ios") {
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                props.onPressIn?.(ev);
            }}
        />
    );
}

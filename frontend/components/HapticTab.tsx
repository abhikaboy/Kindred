import { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { PlatformPressable } from "@react-navigation/elements";
import * as Haptics from "expo-haptics";
import React from "react";

export function HapticTab(props: BottomTabBarButtonProps) {
    return (
        <PlatformPressable
            {...props}
            pressOpacity={0.2}
            style={{
                zIndex: 10,
                borderRadius: 500,
                overflow: "hidden",
            }}
            onPressIn={async (ev) => {
                if (process.env.EXPO_OS === "ios") {
                    console.log("Haptic");
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                }
                props.onPressIn?.(ev);
            }}
        />
    );
}

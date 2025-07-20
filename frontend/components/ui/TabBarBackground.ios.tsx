import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import { StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function BlurTabBarBackground() {
    return (
        <BlurView
            // System chrome material automaiically adapts to the system's theme
            // and matches the native tab bar appearance on iOS.
            tint={"prominent"}
            intensity={35}
            style={[
                StyleSheet.absoluteFill,
                {
                    justifyContent: "center",
                    alignItems: "center",
                },
            ]}
        />
    );
}

export function useBottomTabOverflow() {
    const tabHeight = 10;
    const { bottom } = useSafeAreaInsets();
    return tabHeight - bottom;
}

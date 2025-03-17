import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import { StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ThemedColor from "react-native/Libraries/NewAppScreen";

export default function BlurTabBarBackground() {
    return (
        <BlurView
            // System chrome material automaiically adapts to the system's theme
            // and matches the native tab bar appearance on iOS.
            tint={"prominent"}
            intensity={30}
            style={StyleSheet.absoluteFill}
        />
    );
}

export function useBottomTabOverflow() {
    const tabHeight = useBottomTabBarHeight();
    const { bottom } = useSafeAreaInsets();
    return tabHeight - bottom;
}

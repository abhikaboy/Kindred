import ThemedColor from "../constants/Colors";
import { useColorScheme } from "react-native";

export function useThemeColor() {
    // TODO: use theme from store
    const theme = useColorScheme() ?? "light";
    return ThemedColor[theme];
}

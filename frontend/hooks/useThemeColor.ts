import { getThemedColor } from "../constants/Colors";
import { useColorScheme } from "react-native";

export function useThemeColor() {
    const colorScheme = useColorScheme() ?? "light";
    return getThemedColor(colorScheme);
}

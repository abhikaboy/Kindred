import { getThemedColor } from "../constants/Colors";
import { Appearance } from "react-native";

export function useThemeColor(forceTheme?: "light" | "dark") {
    const theme = forceTheme ?? Appearance.getColorScheme() ?? "light";
    return getThemedColor(theme);
}

import { getThemedColor } from "../constants/Colors";
import { Appearance } from "react-native";

export function useThemeColor() {
    return getThemedColor(Appearance.getColorScheme() ?? "light");
}

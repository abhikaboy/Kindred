import { getThemedColor } from "../constants/Colors";
import { useColorScheme } from "react-native";
import { Appearance } from "react-native";

export function useThemeColor() {
    // TODO: use theme from store
    // const theme = useColorScheme() ?? "light";
    return getThemedColor(Appearance.getColorScheme() ?? "light");
}

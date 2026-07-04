import { getThemedColor } from "@/constants/Colors";
import { useColorScheme } from "react-native";

export function useThemeColor(forceTheme?: "light" | "dark") {
    // Reactive: re-renders on system theme change or Appearance.setColorScheme override
    const scheme = useColorScheme();
    return getThemedColor(forceTheme ?? scheme ?? "light");
}

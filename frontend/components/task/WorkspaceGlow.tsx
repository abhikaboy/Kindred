import React, { useId } from "react";
import { StyleSheet, View, useColorScheme } from "react-native";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";

const PURPLE = "#854DFF";
const BLUE = "#4D9EFF";
// ponytail: all tuning lives here — adjust after on-device check (OLEDs crush faint tints)
const PEAK = {
    dark: { purple: 0.08, blue: 0.05 },
    light: { purple: 0.1, blue: 0.06 },
};

/** Static two-hue ambient glow behind the workspace list. known-app inspired; deliberately faint. */
export default function WorkspaceGlow() {
    const scheme = useColorScheme() ?? "light";
    const peak = PEAK[scheme];
    const baseId = useId().replace(/:/g, "");

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                <Defs>
                    <RadialGradient id={`${baseId}-purple`} cx="50%" cy="50%" r="50%">
                        <Stop offset="0" stopColor={PURPLE} stopOpacity={peak.purple} />
                        <Stop offset="1" stopColor={PURPLE} stopOpacity="0" />
                    </RadialGradient>
                    <RadialGradient id={`${baseId}-blue`} cx="50%" cy="50%" r="50%">
                        <Stop offset="0" stopColor={BLUE} stopOpacity={peak.blue} />
                        <Stop offset="1" stopColor={BLUE} stopOpacity="0" />
                    </RadialGradient>
                </Defs>
                <Ellipse cx="30" cy="25" rx="38" ry="19" fill={`url(#${baseId}-purple)`} />
                <Ellipse cx="85" cy="80" rx="33" ry="16" fill={`url(#${baseId}-blue)`} />
            </Svg>
        </View>
    );
}

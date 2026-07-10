import React, { useId } from "react";
import { StyleSheet, View, useColorScheme } from "react-native";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";

export type GlowBlob = {
    color: string;
    /** peak gradient opacity per theme */
    opacity: { dark: number; light: number };
    /** 0-100 screen-space coords; the viewBox stretches to fill the parent */
    cx: number;
    cy: number;
    rx: number;
    ry: number;
    /** gradient falloff radius, default "50%" */
    falloff?: string;
};

/** Static ambient glow layer — deliberately no animation, it costs frames during scroll.
    Blobs are plain data so arrangements stay per-page config. */
export default function GlowBackground({ blobs }: { blobs: GlowBlob[] }) {
    const scheme = useColorScheme() ?? "light";
    const baseId = useId().replace(/:/g, "");

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                <Defs>
                    {blobs.map((b, i) => (
                        <RadialGradient key={i} id={`${baseId}-${i}`} cx="50%" cy="50%" r={b.falloff ?? "50%"}>
                            <Stop offset="0" stopColor={b.color} stopOpacity={b.opacity[scheme]} />
                            <Stop offset="1" stopColor={b.color} stopOpacity="0" />
                        </RadialGradient>
                    ))}
                </Defs>
                {blobs.map((b, i) => (
                    <Ellipse key={i} cx={b.cx} cy={b.cy} rx={b.rx} ry={b.ry} fill={`url(#${baseId}-${i})`} />
                ))}
            </Svg>
        </View>
    );
}

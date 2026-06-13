import React from "react";
import Svg, { Polyline } from "react-native-svg";

interface SparklineProps {
    data: number[];
    color: string;
    width?: number;
    height?: number;
}

/** Tiny completion-trend line for category-health rows. */
export function Sparkline({ data, color, width = 64, height = 24 }: SparklineProps) {
    if (data.length === 0) {
        return null;
    }
    const max = Math.max(1, ...data);
    const step = data.length > 1 ? width / (data.length - 1) : width;
    const points = data
        .map((v, i) => `${(i * step).toFixed(1)},${(height - (v / max) * height).toFixed(1)}`)
        .join(" ");

    return (
        <Svg width={width} height={height}>
            <Polyline
                points={points}
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
            />
        </Svg>
    );
}

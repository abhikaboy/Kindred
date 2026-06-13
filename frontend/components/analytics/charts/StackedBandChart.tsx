import React from "react";
import { View, StyleSheet } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "@/components/ThemedText";
import { AnalyticsShareBand } from "@/api/analytics";

interface StackedBandChartProps {
    bands: AnalyticsShareBand[];
}

/** 100% stacked bands per week/month — one horizontal bar per bucket. */
export function StackedBandChart({ bands }: StackedBandChartProps) {
    const ThemedColor = useThemeColor() as any;
    const styles = stylesheet(ThemedColor);

    return (
        <View style={styles.container}>
            {(bands ?? []).map((band) => (
                <BandRow key={band.label} band={band} ThemedColor={ThemedColor} />
            ))}
        </View>
    );
}

function BandRow({ band, ThemedColor }: { band: AnalyticsShareBand; ThemedColor: any }) {
    const styles = stylesheet(ThemedColor);
    const slices = band.slices ?? [];
    const total = slices.reduce((sum, s) => sum + s.count, 0);

    return (
        <View style={styles.row}>
            <ThemedText type="caption" style={styles.label}>
                {band.label}
            </ThemedText>
            <View style={styles.bar}>
                {total === 0 ? (
                    <View style={[styles.segment, { flex: 1, backgroundColor: ThemedColor.lightened }]} />
                ) : (
                    slices.map((s, i) => (
                        <View
                            key={s.categoryId + i}
                            style={[styles.segment, { flex: Math.max(s.count, 0.0001), backgroundColor: s.color }]}
                        />
                    ))
                )}
            </View>
        </View>
    );
}

const stylesheet = (ThemedColor: any) =>
    StyleSheet.create({
        container: {
            gap: 10,
        },
        row: {
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
        },
        label: {
            width: 40,
        },
        bar: {
            flex: 1,
            height: 16,
            flexDirection: "row",
            borderRadius: 8,
            overflow: "hidden",
        },
        segment: {
            height: "100%",
        },
    });

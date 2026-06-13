import React from "react";
import { View, StyleSheet } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "@/components/ThemedText";
import { AnalyticsSignal, AnalyticsSignals } from "@/api/analytics";
import { directionColor } from "./analyticsColors";

/** Momentum / Timing / Support headline strip. */
export function SignalStrip({ signals }: { signals: AnalyticsSignals }) {
    const ThemedColor = useThemeColor() as any;
    const styles = stylesheet(ThemedColor);
    return (
        <View style={styles.row}>
            <SignalCard signal={signals.momentum} />
            <SignalCard signal={signals.timing} />
            <SignalCard signal={signals.support} />
        </View>
    );
}

function SignalCard({ signal }: { signal: AnalyticsSignal }) {
    const ThemedColor = useThemeColor() as any;
    const styles = stylesheet(ThemedColor);
    return (
        <View style={styles.card}>
            <ThemedText type="caption">{signal.label}</ThemedText>
            <ThemedText type="fancyFrauncesSubheading" style={styles.value}>
                {signal.value}
            </ThemedText>
            <ThemedText type="caption" style={{ color: directionColor(signal.direction, ThemedColor), fontSize: 11 }}>
                {signal.deltaLabel}
            </ThemedText>
        </View>
    );
}

const stylesheet = (ThemedColor: any) =>
    StyleSheet.create({
        row: {
            flexDirection: "row",
            gap: 10,
            marginBottom: 16,
        },
        card: {
            flex: 1,
            backgroundColor: ThemedColor.lightenedCard,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: ThemedColor.tertiary,
            padding: 12,
            gap: 2,
        },
        value: {
            fontSize: 22,
            marginVertical: 2,
        },
    });

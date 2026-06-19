import React from "react";
import { View, StyleSheet } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "@/components/ThemedText";
import { AnalyticsSupportCoverage } from "@/api/analytics";
import { WidgetCard } from "./WidgetCard";

export function SupportCoverageWidget({ supportCoverage }: { supportCoverage: AnalyticsSupportCoverage }) {
    const ThemedColor = useThemeColor() as any;
    const styles = stylesheet(ThemedColor);
    const pct = supportCoverage?.pct ?? 0;

    return (
        <WidgetCard title="Support coverage" takeaway={supportCoverage?.takeaway}>
            <ThemedText type="fancyFrauncesHeading" style={styles.stat}>
                {pct}%
            </ThemedText>
            <View style={styles.track}>
                <View style={[styles.fill, { width: `${pct}%`, backgroundColor: ThemedColor.primary }]} />
            </View>
            <ThemedText type="caption" style={styles.caption}>
                {supportCoverage?.supported ?? 0} of {supportCoverage?.total ?? 0} finished tasks had support
            </ThemedText>
        </WidgetCard>
    );
}

const stylesheet = (ThemedColor: any) =>
    StyleSheet.create({
        stat: {
            fontSize: 30,
            marginBottom: 8,
        },
        track: {
            height: 14,
            borderRadius: 7,
            backgroundColor: ThemedColor.lightened,
            overflow: "hidden",
        },
        fill: {
            height: "100%",
            borderRadius: 7,
        },
        caption: {
            marginTop: 8,
        },
    });

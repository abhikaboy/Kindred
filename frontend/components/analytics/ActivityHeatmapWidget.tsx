import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "@/components/ThemedText";
import { AnalyticsHeatmap } from "@/api/analytics";
import { WidgetCard } from "./WidgetCard";
import { MonthHeatmap } from "./charts/MonthHeatmap";
import { heatmapLevelColor } from "./analyticsColors";
import CompletedTasksBottomSheetModal from "@/components/modals/CompletedTasksBottomSheetModal";

export function ActivityHeatmapWidget({ heatmap }: { heatmap: AnalyticsHeatmap }) {
    const ThemedColor = useThemeColor() as any;
    const styles = stylesheet(ThemedColor);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [modalVisible, setModalVisible] = useState(false);

    const onSelectDay = (date: Date) => {
        setSelectedDate(date);
        setModalVisible(true);
    };

    return (
        <WidgetCard title="Activity heatmap" takeaway={heatmap.takeaway}>
            <MonthHeatmap days={heatmap.days} onSelectDay={onSelectDay} />

            <View style={styles.footer}>
                <ThemedText type="caption">Tap a day to see what you finished</ThemedText>
                <View style={styles.legend}>
                    <ThemedText type="caption">Less</ThemedText>
                    {[0, 1, 2, 3, 4].map((level) => (
                        <View key={level} style={[styles.cell, { backgroundColor: heatmapLevelColor(level, ThemedColor) }]} />
                    ))}
                    <ThemedText type="caption">More</ThemedText>
                </View>
            </View>

            <CompletedTasksBottomSheetModal visible={modalVisible} setVisible={setModalVisible} date={selectedDate} />
        </WidgetCard>
    );
}

const stylesheet = (ThemedColor: any) =>
    StyleSheet.create({
        footer: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 12,
            flexWrap: "wrap",
            gap: 8,
        },
        legend: {
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
        },
        cell: {
            width: 12,
            height: 12,
            borderRadius: 3,
        },
    });

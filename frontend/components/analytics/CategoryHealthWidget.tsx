import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "@/components/ThemedText";
import { AnalyticsCategoryHealth, AnalyticsCategoryHealthRow } from "@/api/analytics";
import { WidgetCard } from "./WidgetCard";
import { StatusPill } from "./StatusPill";
import { Sparkline } from "./charts/Sparkline";

interface Props {
    categoryHealth: AnalyticsCategoryHealth;
    onSelectCategory?: (categoryId: string) => void;
}

export function CategoryHealthWidget({ categoryHealth, onSelectCategory }: Props) {
    const ThemedColor = useThemeColor() as any;
    const styles = stylesheet(ThemedColor);

    if (categoryHealth.rows.length === 0) {
        return (
            <WidgetCard title="Category health">
                <ThemedText type="caption">No category activity in this period yet.</ThemedText>
            </WidgetCard>
        );
    }

    return (
        <WidgetCard title="Category health">
            <View style={styles.list}>
                {categoryHealth.rows.map((row) => (
                    <CategoryHealthRowItem key={row.categoryId} row={row} onSelectCategory={onSelectCategory} />
                ))}
            </View>
        </WidgetCard>
    );
}

function CategoryHealthRowItem({
    row,
    onSelectCategory,
}: {
    row: AnalyticsCategoryHealthRow;
    onSelectCategory?: (categoryId: string) => void;
}) {
    const ThemedColor = useThemeColor() as any;
    const styles = stylesheet(ThemedColor);
    return (
        <TouchableOpacity
            style={styles.row}
            activeOpacity={0.6}
            disabled={!onSelectCategory}
            onPress={() => onSelectCategory?.(row.categoryId)}>
            <View style={styles.left}>
                <View style={[styles.dot, { backgroundColor: row.color }]} />
                <View style={styles.nameCol}>
                    <ThemedText type="defaultSemiBold" style={styles.name}>
                        {row.name}
                    </ThemedText>
                    <ThemedText type="caption">{row.onTimePct}% on time · {row.kudos} Kudos</ThemedText>
                </View>
            </View>
            <View style={styles.right}>
                <Sparkline data={row.sparkline} color={row.color} width={48} height={20} />
                <StatusPill status={row.status} />
            </View>
        </TouchableOpacity>
    );
}

const stylesheet = (ThemedColor: any) =>
    StyleSheet.create({
        list: {
            gap: 14,
        },
        row: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
        },
        left: {
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            flexShrink: 1,
        },
        nameCol: {
            flexShrink: 1,
            gap: 2,
        },
        name: {
            fontSize: 15,
        },
        right: {
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
        },
        dot: {
            width: 10,
            height: 10,
            borderRadius: 5,
        },
    });

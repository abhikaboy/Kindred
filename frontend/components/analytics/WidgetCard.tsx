import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { CaretRight } from "phosphor-react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "@/components/ThemedText";

interface WidgetCardCTA {
    label: string;
    onPress: () => void;
}

interface WidgetCardProps {
    title: string;
    headerRight?: React.ReactNode;
    takeaway?: string;
    cta?: WidgetCardCTA;
    onPress?: () => void;
    children: React.ReactNode;
}

/**
 * Shared shell for every analytics widget: title row, visualization, optional
 * one-line takeaway and CTA. Left-aligned, dark-elevated surface.
 */
export function WidgetCard({ title, headerRight, takeaway, cta, onPress, children }: WidgetCardProps) {
    const ThemedColor = useThemeColor() as any;
    const styles = stylesheet(ThemedColor);

    const Container: any = onPress ? TouchableOpacity : View;
    const containerProps = onPress ? { onPress, activeOpacity: 0.85 } : {};

    return (
        <Container style={styles.card} {...containerProps}>
            <View style={styles.header}>
                <ThemedText type="defaultSemiBold" style={styles.title}>
                    {title}
                </ThemedText>
                {headerRight}
            </View>

            {children}

            {takeaway ? (
                <ThemedText type="caption" style={styles.takeaway}>
                    {takeaway}
                </ThemedText>
            ) : null}

            {cta ? (
                <TouchableOpacity style={styles.cta} onPress={cta.onPress} activeOpacity={0.7}>
                    <ThemedText type="defaultSemiBold" style={{ color: ThemedColor.primary }}>
                        {cta.label}
                    </ThemedText>
                    <CaretRight size={16} color={ThemedColor.primary} weight="bold" />
                </TouchableOpacity>
            ) : null}
        </Container>
    );
}

const stylesheet = (ThemedColor: any) =>
    StyleSheet.create({
        card: {
            backgroundColor: ThemedColor.lightenedCard,
            borderRadius: 24,
            padding: 16,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: ThemedColor.tertiary,
        },
        header: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
        },
        title: {
            fontSize: 17,
        },
        takeaway: {
            marginTop: 12,
            lineHeight: 18,
        },
        cta: {
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            marginTop: 12,
        },
    });

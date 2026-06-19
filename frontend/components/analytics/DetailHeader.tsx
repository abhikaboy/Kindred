import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { CaretLeft } from "phosphor-react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "@/components/ThemedText";

interface DetailHeaderProps {
    title: string;
    subtitle?: string;
    right?: React.ReactNode;
}

/** Back-chevron + title row for analytics drilldown screens. */
export function DetailHeader({ title, subtitle, right }: DetailHeaderProps) {
    const ThemedColor = useThemeColor() as any;
    const styles = stylesheet(ThemedColor);
    return (
        <View style={styles.container}>
            <TouchableOpacity style={styles.back} activeOpacity={0.7} onPress={() => router.back()}>
                <CaretLeft size={22} color={ThemedColor.text} weight="bold" />
            </TouchableOpacity>
            <View style={styles.titleCol}>
                <ThemedText type="fancyFrauncesSubheading">{title}</ThemedText>
                {subtitle ? <ThemedText type="caption">{subtitle}</ThemedText> : null}
            </View>
            {right ? <View style={styles.right}>{right}</View> : null}
        </View>
    );
}

const stylesheet = (ThemedColor: any) =>
    StyleSheet.create({
        container: {
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingHorizontal: 16,
            paddingBottom: 12,
        },
        back: {
            padding: 4,
        },
        titleCol: {
            flex: 1,
        },
        right: {
            marginLeft: "auto",
        },
    });

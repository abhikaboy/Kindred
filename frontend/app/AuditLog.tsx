import { Dimensions, StyleSheet, View } from "react-native";
import React from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { ScrollView } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";

const AuditLog = () => {
    const ThemedColor = useThemeColor();

    return (
        <ThemedView
            style={{ paddingTop: Dimensions.get("screen").height * 0.12, paddingHorizontal: HORIZONTAL_PADDING }}>
            <ScrollView style={{ height: "100%" }}>
                <ThemedText type="title">Audit Log</ThemedText>
                <ThemedText type="default" style={{ color: ThemedColor.caption, marginTop: 16 }}>
                    No audit entries. Request history tracking has been removed in favor of network inspector tools.
                </ThemedText>
            </ScrollView>
        </ThemedView>
    );
};

export default AuditLog;

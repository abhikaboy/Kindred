import { View, Text, Dimensions, ScrollView } from "react-native";
import React from "react";
import { ThemedText } from "@/components/ThemedText";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { useThemeColor } from "@/hooks/useThemeColor";
import ProgressBar from "@/components/ui/ProgressBar";

export default function Dev3() {
    const ThemedColor = useThemeColor();
    return (
        <View
            style={{
                backgroundColor: ThemedColor.background,
                height: Dimensions.get("screen").height,
                flex: 1,
                paddingTop: Dimensions.get("screen").height * 0.12,
                paddingHorizontal: HORIZONTAL_PADDING,
                gap: 16,
            }}>
            <ThemedText type="title" style={{ fontWeight: "700" }}>
                Development Components 3 - Random
            </ThemedText>
            <ScrollView
                contentContainerStyle={{
                    gap: 16,
                    paddingBottom: Dimensions.get("screen").height * 0.12,
                }}>
                <ProgressBar />
            </ScrollView>
        </View>
    );
}

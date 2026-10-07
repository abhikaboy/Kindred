import { Dimensions, StyleSheet, TouchableOpacity, View } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import React, { useState } from "react";
import { useThemeColor } from "@/hooks/useThemeColor";
type Props = {
    onPress?: () => void;
    text: string;
};

export default function NextButton({ onPress }: Props) {
    let ThemedColor = useThemeColor();

    return (
        <TouchableOpacity
            onPress={onPress}
            style={{
                backgroundColor: ThemedColor.primary,
                borderRadius: 100,
                paddingVertical: 16,
                paddingHorizontal: 20,
                width: Dimensions.get("screen").width * 0.3,
                minWidth: Dimensions.get("screen").width * 0.3,
            }}>
            <ThemedText
                type="defaultSemiBold"
                style={{
                    color: ThemedColor.text,
                    textAlign: "center",
                }}>
                Next
            </ThemedText>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({});

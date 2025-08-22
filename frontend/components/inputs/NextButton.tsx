import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from "react-native";
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
            <Text
                style={{
                    color: ThemedColor.text,
                    fontFamily: "Outfit",
                    textAlign: "center",
                    fontWeight: 400,
                }}>
                Next
            </Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({});

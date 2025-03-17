import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import React, { useState } from "react";
import ThemedColor from "@/constants/Colors";

type Props = {
    onPress?: () => void;
};

export default function NextButton({ onPress }: Props) {
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

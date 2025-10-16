import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import React, { useState } from "react";
import { useThemeColor } from "@/hooks/useThemeColor";
import AntDesign from "@expo/vector-icons/AntDesign";

type Props = {
    onSend?: () => void;
};

export default function SendButton({ onSend }: Props) {
    let ThemedColor = useThemeColor();

    return (
        <View style={{ display: "inline-flex", alignSelf: "flex-end" }}>
            <TouchableOpacity
                onPress={onSend}
                style={{
                    backgroundColor: ThemedColor.primary,
                    borderRadius: 40,
                    paddingVertical: 15,
                    paddingHorizontal: 25,
                }}>
                <AntDesign name="arrow-up" size={16} color="white" />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({});

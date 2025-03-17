import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import React, { useState } from "react";
import ThemedColor from "@/constants/Colors";
import AntDesign from "@expo/vector-icons/AntDesign";

type Props = {
    onSend?: () => void;
};

export default function SendButton({ onSend }: Props) {
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
                <AntDesign name="arrowup" size={16} color="white" />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({});

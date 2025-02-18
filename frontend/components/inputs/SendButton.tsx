import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import React, { useState } from "react";
import { Colors } from "@/constants/Colors";
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
                    backgroundColor: Colors.dark.primary,
                    borderRadius: 20,
                    paddingVertical: 8,
                    paddingHorizontal: 20,
                }}>
                <AntDesign name="arrowup" size={16} color="white" />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({});

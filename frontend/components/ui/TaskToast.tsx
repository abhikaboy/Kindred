import { View, Text, Animated } from "react-native";
import React from "react";
import { ThemedText } from "../ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import ProgressBar from "./ProgressBar";
import Entypo from "@expo/vector-icons/Entypo";
import { ToastableBodyParams } from "react-native-toastable";

export default function TaskToast(props: ToastableBodyParams) {
    const ThemedColor = useThemeColor();
    return (
        <Animated.View
            style={{
                backgroundColor: ThemedColor.tertiary,
                borderRadius: 12,
                boxShadow: `0px 4px 16px 0px #00000050`,
                flexDirection: "column",
                padding: 0,
            }}>
            <View
                style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    padding: 20,
                }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, width: "80%" }}>
                    <Text style={{ fontSize: 30, fontWeight: "bold" }}>🎉</Text>
                    <ThemedText>{props.message}</ThemedText>
                </View>
                <Entypo name="chevron-right" size={24} color={ThemedColor.text} />
            </View>
            <ProgressBar start={0} bar={ThemedColor.success} />
        </Animated.View>
    );
}

import React from "react";
import { View, Text } from "react-native";
import { ToastableBodyParams } from "react-native-toastable";
import { ThemedText } from "../ThemedText";
import Entypo from "@expo/vector-icons/Entypo";
import { useThemeColor } from "@/hooks/useThemeColor";

export default function DefaultToast({ status, message }: ToastableBodyParams) {
    const ThemedColor = useThemeColor();
    const statusMapping = {
        success: {
            color: ThemedColor.success,
            icon: "check",
        },
        danger: {
            color: ThemedColor.error,
            icon: "cross",
        },
        warning: {
            color: ThemedColor.warning,
            icon: "warning",
        },
        info: {
            color: ThemedColor.primary,
            icon: "info",
        },
    };
    const icon = <Entypo name={statusMapping[status].icon as any} size={24} color={statusMapping[status].color} />;
    return (
        <View style={{ flex: 1, alignItems: "center" }}>
            <View
                style={{
                    width: "70%",
                    alignItems: "center",
                    gap: 2,
                    borderRadius: 8,
                    borderBottomWidth: 3,
                    boxShadow: "0 6px 12px 0 #00000080",
                    borderColor: statusMapping[status].color,
                    padding: 16,
                    backgroundColor: ThemedColor.lightened,
                }}>
                <ThemedText style={{ textAlign: "center" }}>{message}</ThemedText>
            </View>
        </View>
    );
}

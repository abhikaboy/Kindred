import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import React from "react";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "../ThemedText";
import Svg, { Path } from "react-native-svg";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { router } from "expo-router";

type Props = {
    children?: React.ReactNode;
    title: string;
    icon: React.ReactNode;
    onPress: () => void;
};

const DashboardCard = (props: Props) => {
    const ThemedColor = useThemeColor();
    const { title, icon, onPress } = props;
    return (
        <TouchableOpacity
            style={{
                backgroundColor: ThemedColor.lightened,
                borderRadius: 12,
                padding: 16,
                aspectRatio: 1.36,
                justifyContent: "flex-end",
                width: (Dimensions.get("window").width - HORIZONTAL_PADDING * 2) / 2.1,
                borderWidth: 1,
                borderColor: "#ffffff08",
                boxShadow: ThemedColor.shadowSmall,
            }}
            onPress={onPress}>
            <View style={{ flexDirection: "column", alignItems: "flex-start", gap: 8, width: "100%" }}>
                {icon}

                <View style={{ flexDirection: "row", justifyContent: "space-between", width: "100%" }}>
                    <ThemedText type="default">{title}</ThemedText>
                    <ThemedText type="defaultSemiBold">{"→"}</ThemedText>
                </View>
            </View>
        </TouchableOpacity>
    );
};

export default DashboardCard;

const styles = StyleSheet.create({});

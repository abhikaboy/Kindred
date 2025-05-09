import { StyleSheet, Text, View } from "react-native";
import React from "react";
import { useThemeColor } from "@/hooks/useThemeColor";
type Props = {
    level: number;
};
let ThemedColor = useThemeColor();
const LEVELS = { 1: ThemedColor.text, 2: "#aff0c6", 3: "#5CFF95", 4: "#069A3A" };
const ActivityPoint = ({ level }: Props) => {
    return (
        <View
            style={{
                width: 40,
                height: 40,
                borderRadius: 5,
                backgroundColor: LEVELS[level],
            }}
        />
    );
};

export default ActivityPoint;

const styles = StyleSheet.create({});

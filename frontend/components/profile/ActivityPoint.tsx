import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import React, { useState } from "react";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "../ThemedText";
type Props = {
    level: number;
};
const ActivityPoint = ({ level }: Props) => {
    let ThemedColor = useThemeColor();
    const LEVELS = { 1: ThemedColor.text, 2: "#aff0c6", 3: "#5CFF95", 4: "#069A3A" };
    const [display, setDisplay] = useState(false);
    return (
        <TouchableOpacity onPress={() => setDisplay(!display)}>
            <View
                style={{
                    width: 40,
                    height: 40,
                    borderRadius: 5,
                    backgroundColor: LEVELS[level],
                    justifyContent: "center",
                }}>
                {display && (
                    <ThemedText
                        type="lightBody"
                        style={{
                            color: ThemedColor.background,
                            textAlign: "center",
                        }}>
                        {level}
                    </ThemedText>
                )}
            </View>
        </TouchableOpacity>
    );
};

export default ActivityPoint;

const styles = StyleSheet.create({});

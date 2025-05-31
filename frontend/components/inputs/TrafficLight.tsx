import { StyleSheet, Text, View, Switch, Dimensions, TouchableOpacity } from "react-native";
import React from "react";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "../ThemedText";
type Props = {
    setValue: (value: number) => void;
    value: number;
};
type Entry = {
    color: string;
    label: string;
};
const TrafficLight = ({ setValue, value }: Props) => {
    let ThemedColor = useThemeColor();

    return (
        <View
            style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
            }}>
            {[
                { color: ThemedColor.success, label: "Low" },
                { color: ThemedColor.warning, label: "Medium" },
                { color: ThemedColor.error, label: "High" },
            ].map((entry, index) => {
                return (
                    <TouchableOpacity
                        key={index}
                        style={{ alignItems: "center", flexDirection: "row-reverse", gap: 8 }}
                        onPress={() => {
                            setValue(index + 1);
                        }}>
                        <View style={{ ...styles.buttonBase, backgroundColor: entry.color }}>
                            {value - 1 === index && (
                                <View
                                    style={{
                                        ...styles.selected,
                                        backgroundColor: "#fff",
                                    }}
                                />
                            )}
                        </View>
                        <ThemedText type="default">{entry.label}</ThemedText>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
};

export default TrafficLight;

const styles = StyleSheet.create({
    buttonBase: {
        width: Dimensions.get("screen").width * 0.075,
        height: Dimensions.get("screen").width * 0.075,
        borderRadius: 100,
    },
    selected: {
        width: Dimensions.get("screen").width * 0.045,
        height: Dimensions.get("screen").width * 0.045,
        borderRadius: 100,
        margin: "auto",
    },
});

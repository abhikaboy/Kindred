import { StyleSheet, Text, View, Switch, Dimensions, TouchableOpacity } from "react-native";
import React from "react";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "../ThemedText";
type Props = {};
type Entry = {
    color: string;
    label: string;
};
const TrafficLight = (props: Props) => {
    const [value, setValue] = React.useState(0);
    let ThemedColor = useThemeColor();

    return (
        <View
            style={{
                display: "flex",
                flexDirection: "row",
                gap: 16,
            }}>
            {[
                { color: ThemedColor.success, label: "Low" },
                { color: ThemedColor.warning, label: "Medium" },
                { color: ThemedColor.error, label: "High" },
            ].map((entry, index) => {
                return (
                    <TouchableOpacity
                        key={index}
                        style={{ alignItems: "center", flexDirection: "row", gap: 8 }}
                        onPress={() => {
                            setValue(index);
                        }}>
                        <View style={{ ...styles.buttonBase, backgroundColor: entry.color }}>
                            {value === index && (
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

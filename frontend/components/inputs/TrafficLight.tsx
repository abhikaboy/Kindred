import { StyleSheet, Text, View, Switch, Dimensions, TouchableOpacity } from "react-native";
import React from "react";
import { useThemeColor } from "@/hooks/useThemeColor";
type Props = {};

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
            {[ThemedColor.error, ThemedColor.warning, ThemedColor.success].map((color, index) => {
                return (
                    <TouchableOpacity
                        key={index}
                        style={{ ...styles.buttonBase, backgroundColor: color }}
                        onPress={() => {
                            setValue(index);
                        }}>
                        {value === index && (
                            <View
                                style={{
                                    ...styles.selected,
                                    backgroundColor: "#fff",
                                }}
                            />
                        )}
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

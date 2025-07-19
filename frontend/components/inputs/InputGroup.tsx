import React from "react";
import { Dimensions, TextInput, View, StyleSheet, Switch } from "react-native";
import { ThemedText } from "../ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import ConditionalView from "../ui/ConditionalView";

const InputGroup = ({
    options,
}: {
    options: { label: string; value: string | boolean; placeholder: string; type: string }[];
}) => {
    let ThemedColor = useThemeColor();
    const styles = useStyles(ThemedColor);
    return (
        <View style={styles.container}>
            {options.map((option) => (
                <View key={option.label} style={styles.optionRow}>
                    <ThemedText type="lightBody" style={styles.label}>
                        {option.label}
                    </ThemedText>
                    <ConditionalView condition={option.type === "text"}>
                        <TextInput
                            value={option.value as string}
                            placeholder={option.placeholder}
                            style={styles.input}
                        />
                    </ConditionalView>
                    <ConditionalView condition={option.type === "toggle"}>
                        <Switch
                            value={option.value as boolean}
                            trackColor={{ false: ThemedColor.tertiary, true: ThemedColor.primary }}
                            onValueChange={() => {
                                console.log("toggle");
                                // update the value
                                option.value = !option.value;
                            }}
                        />
                    </ConditionalView>
                </View>
            ))}
        </View>
    );
};

const useStyles = (ThemedColor: any) =>
    StyleSheet.create({
        container: {
            paddingVertical: 16,
            borderRadius: 12,
            backgroundColor: ThemedColor.lightened,
            gap: 24,
            borderWidth: 1,
            borderColor: ThemedColor.tertiary,
            shadowColor: "rgba(0, 0, 0, 0.05)",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 1,
            shadowRadius: 4,
            elevation: 2,
        },
        optionRow: {
            display: "flex",
            flexDirection: "row",
            paddingHorizontal: 30,
        },
        label: {
            width: Dimensions.get("window").width * 0.4,
            color: "#838383",
        },
        input: {
            color: ThemedColor.text,
            fontFamily: "OutfitLight",
        },
    });
export default InputGroup;

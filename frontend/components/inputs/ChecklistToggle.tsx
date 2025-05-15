import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import React, { useState } from "react";
import { useThemeColor } from "@/hooks/useThemeColor";

type Props = {};

const ChecklistToggle = (props: Props) => {
    const [checked, setChecked] = useState(false);
    const ThemedColor = useThemeColor();
    return (
        <TouchableOpacity
            onPress={() => setChecked(!checked)}
            style={{
                backgroundColor: checked ? ThemedColor.primary : "#282738",
                paddingVertical: 10,
                paddingHorizontal: 10,
                borderRadius: 8,
                maxWidth: 16,
                maxHeight: 16,
            }}
        />
    );
};

export default ChecklistToggle;

const styles = StyleSheet.create({});

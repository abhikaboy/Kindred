import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import React, { useState } from "react";
import { useThemeColor } from "@/hooks/useThemeColor";

type Props = {
    checked?: boolean;
    onToggle?: () => void;
};

const ChecklistToggle = ({ checked = false, onToggle }: Props) => {
    const ThemedColor = useThemeColor();
    return (
        <TouchableOpacity
            onPress={onToggle}
            style={{
                backgroundColor: checked ? ThemedColor.primary : ThemedColor.tertiary,
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

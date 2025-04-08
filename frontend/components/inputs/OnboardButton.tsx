import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import React from "react";
import { useThemeColor } from "@/hooks/useThemeColor";
import AntDesign from "@expo/vector-icons/AntDesign";
type Props = {
    onPress: () => void;
    disabled: boolean;
};

const OnboardButton = ({ onPress, disabled }: Props) => {
    let ThemedColor = useThemeColor();

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled}
            style={{
                position: "absolute",
                bottom: Dimensions.get("screen").width * 0.2,
                right: Dimensions.get("screen").width * 0.1,
                padding: 24,
                backgroundColor: disabled ? ThemedColor.disabled : ThemedColor.primary,
                borderRadius: 400,
            }}>
            <AntDesign name="arrowright" size={24} color="white" />
        </TouchableOpacity>
    );
};

export default OnboardButton;

const styles = StyleSheet.create({});

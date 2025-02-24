import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import React from "react";
import { Colors } from "@/constants/Colors";
import AntDesign from "@expo/vector-icons/AntDesign";
type Props = {
    onPress: () => void;
    disabled: boolean;
};

const OnboardButton = ({ onPress, disabled }: Props) => {
    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled}
            style={{
                position: "absolute",
                bottom: Dimensions.get("screen").width * 0.2,
                right: Dimensions.get("screen").width * 0.1,
                padding: 24,
                backgroundColor: disabled ? Colors.dark.disabled : Colors.dark.primary,
                borderRadius: 400,
            }}>
            <AntDesign name="arrowright" size={24} color="white" />
        </TouchableOpacity>
    );
};

export default OnboardButton;

const styles = StyleSheet.create({});

import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from "react-native";
import React from "react";
import ThemedColor from "@/constants/Colors";

type Props = {
    title: string;
    onPress: () => void;
    style?: ViewStyle;
};

export default function PrimaryButton({ title, onPress, style }: Props) {
    return (
        <TouchableOpacity
            onPress={onPress}
            style={[
                {
                    width: "100%",
                    backgroundColor: ThemedColor.primary,
                    borderRadius: 20,
                    paddingVertical: 16,
                },
                style,
            ]}>
            <Text
                style={{
                    color: ThemedColor.buttonText,
                    textAlign: "center",
                    fontFamily: "Outfit",
                    fontWeight: 500,
                }}>
                {title}
            </Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({});

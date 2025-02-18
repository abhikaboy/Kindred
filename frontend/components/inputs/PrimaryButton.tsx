import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import React from "react";
import { Colors } from "@/constants/Colors";

type Props = {
    title: string;
    onPress: () => void;
};

export default function PrimaryButton({ title, onPress }: Props) {
    return (
        <TouchableOpacity
            onPress={onPress}
            style={{
                width: "100%",
                backgroundColor: Colors.dark.primary,
                borderRadius: 20,
                paddingVertical: 20,
            }}>
            <Text
                style={{
                    color: Colors.dark.text,
                    textAlign: "center",
                    fontFamily: "Outfit",
                    fontWeight: 600,
                }}>
                {title}
            </Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({});

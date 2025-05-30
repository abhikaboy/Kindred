import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from "react-native";
import React from "react";
import { useThemeColor } from "@/hooks/useThemeColor";
type Props = {
    title: string;
    onPress: () => void;
    style?: ViewStyle;
    ghost?: boolean;
    outline?: boolean;
    disabled?: boolean;
};

export default function PrimaryButton({ title, onPress, style, ghost, outline, disabled }: Props) {
    let ThemedColor = useThemeColor();

    return (
        <TouchableOpacity
            disabled={disabled}
            onPress={onPress}
            style={[
                {
                    width: "100%",
                    backgroundColor: ghost
                        ? "transparent"
                        : outline
                          ? ThemedColor.lightened + "20"
                          : ThemedColor.primary,
                    borderRadius: 12,
                    paddingVertical: 16,
                    borderWidth: outline ? 1 : 0,
                    borderColor: outline ? ThemedColor.primary : "transparent",
                    opacity: disabled ? 0.5 : 1,
                },
                style,
            ]}>
            <Text
                style={{
                    color: ghost || outline ? ThemedColor.primary : ThemedColor.buttonText,
                    textAlign: "center",
                    fontFamily: "Outfit",
                    fontWeight: 500,
                    fontSize: 15,
                }}>
                {title}
            </Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({});

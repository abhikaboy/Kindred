import { StyleSheet, Text, TouchableOpacity, View, ViewStyle, TextStyle } from "react-native";
import React from "react";
import { useThemeColor } from "@/hooks/useThemeColor";
type Props = {
    title: string;
    onPress: () => void;
    style?: ViewStyle;
    ghost?: boolean;
    outline?: boolean;
    dottedOutline?: boolean;
    disabled?: boolean;
    children?: React.ReactNode;
    textStyle?: TextStyle;
};

export default function PrimaryButton({ title, onPress, style, ghost, outline, dottedOutline, disabled, children, textStyle }: Props) {
    let ThemedColor = useThemeColor();

    return (
        <TouchableOpacity
            disabled={disabled}
            onPress={onPress}
            style={[
                {
                    width: "100%",
                    backgroundColor: ghost || dottedOutline
                        ? "transparent"
                        : outline
                          ? ThemedColor.lightened + "20"
                          : ThemedColor.primary,
                    borderRadius: 12,
                    paddingVertical: 16,
                    borderWidth: outline || dottedOutline ? 1 : 0,
                    borderColor: outline || dottedOutline ? ThemedColor.primary : "transparent",
                    borderStyle: dottedOutline ? "dashed" : "solid",
                    opacity: disabled ? 0.5 : 1,
                },
                style,
            ]}>
            {children}
            <Text
                style={{
                    color: ghost || outline || dottedOutline ? ThemedColor.primary : ThemedColor.buttonText,
                    textAlign: "center",
                    fontFamily: "Outfit",
                    fontWeight: 500,
                    fontSize: 15,
                    ...textStyle,
                }}>
                {title}
            </Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({});

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
    lightened?: boolean;
    secondary?: boolean;
    disabled?: boolean;
    children?: React.ReactNode;
    textStyle?: TextStyle;
    colorOverride?: string;
};

export default function PrimaryButton({ title, onPress, style, ghost, outline, dottedOutline, lightened, secondary, disabled, children, textStyle, colorOverride }: Props) {
    let ThemedColor = useThemeColor();

    const getBackgroundColor = () => {
        if (ghost || dottedOutline) return "transparent";
        if (secondary) return ThemedColor.primary + "30";
        if (lightened) return ThemedColor.primary + "25";
        if (outline) return ThemedColor.lightened;
        return ThemedColor.primary;
    };

    const getTextColor = () => {
        if (colorOverride) return colorOverride;
        if (outline) return ThemedColor.caption;
        if (ghost || dottedOutline || lightened || secondary) return ThemedColor.primary;
        return ThemedColor.buttonText;
    };

    return (
        <TouchableOpacity
            disabled={disabled}
            onPress={onPress}
            style={[
                {
                    width: "100%",
                    backgroundColor: getBackgroundColor(),
                    borderRadius: 12,
                    paddingVertical: 16,
                    borderWidth: outline || dottedOutline ? 1 : 0,
                    borderColor: outline || dottedOutline ? ThemedColor.caption : "transparent",
                    borderStyle: dottedOutline ? "dashed" : "solid",
                    opacity: disabled ? 0.5 : 1,
                },
                style,
            ]}>
            {children}
            <Text
                style={{
                    color: getTextColor(),
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

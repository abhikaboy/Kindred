/* eslint-disable import/no-unresolved */
import { Text, type TextProps, StyleSheet } from "react-native";

import { useThemeColor } from "@/hooks/useThemeColor";
import React from "react";
import { Colors } from "@/constants/Colors";

export type ThemedTextProps = TextProps & {
    lightColor?: string;
    darkColor?: string;
    type?: "default" | "title" | "defaultSemiBold" | "subtitle" | "link" | "hero" | "lightBody" | "caption";
};

export function ThemedText({ style, lightColor, darkColor, type = "default", ...rest }: ThemedTextProps) {
    const color = Colors.dark.text;

    return (
        <Text
            style={[
                { color },
                type === "default" ? styles.default : undefined,
                type === "title" ? styles.title : undefined,
                type === "defaultSemiBold" ? styles.defaultSemiBold : undefined,
                type === "subtitle" ? styles.subtitle : undefined,
                type === "link" ? styles.link : undefined,
                type === "hero" ? { fontSize: 48, fontWeight: "bold", color: Colors.dark.header } : undefined,
                type === "lightBody" ? styles.lightBody : undefined,
                type === "caption" ? styles.caption : undefined,
                style,
            ]}
            {...rest}
        />
    );
}

const styles = StyleSheet.create({
    default: {
        fontSize: 16,
        lineHeight: 24,
        fontFamily: "Outfit",
    },
    caption: {
        fontSize: 14,
        fontFamily: "Outfit",
        color: Colors.dark.caption,
    },
    lightBody: {
        fontSize: 16,
        lineHeight: 24,
        fontFamily: "Outfit",
        fontWeight: 300,
    },
    defaultSemiBold: {
        fontSize: 20,
        lineHeight: 24,
        fontWeight: "regular",
        fontFamily: "Outfit",
    },
    title: {
        fontSize: 32,
        fontWeight: "medium",
        lineHeight: 32,
        fontFamily: "Outfit",
    },
    subtitle: {
        fontSize: 24,
        fontWeight: "bold",
        fontFamily: "Outfit",
    },
    link: {
        lineHeight: 30,
        fontSize: 16,
        color: "#444444",
        fontFamily: "Outfit",
    },
    tiny: {
        fontSize: 12,
        color: "#FFFFFF",
        fontFamily: "Outfit",
    },
});

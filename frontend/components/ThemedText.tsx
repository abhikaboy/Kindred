/* eslint-disable import/no-unresolved */
import { Text, type TextProps, StyleSheet } from "react-native";

import { useThemeColor } from "@/hooks/useThemeColor";
import React from "react";
import ThemedColor from "@/constants/Colors";

export type ThemedTextProps = TextProps & {
    lightColor?: string;
    darkColor?: string;
    type?: "default" | "heading" | "title" | "defaultSemiBold" | "subtitle" | "link" | "hero" | "lightBody" | "caption";
};

export function ThemedText({ style, lightColor, darkColor, type = "default", ...rest }: ThemedTextProps) {
    // use color from theme
    const color = ThemedColor.text;

    return (
        <Text
            style={[
                { color },
                type === "default" ? styles.default : undefined,
                type === "title" ? styles.title : undefined,
                type === "heading" ? styles.heading : undefined,
                type === "defaultSemiBold" ? styles.defaultSemiBold : undefined,
                type === "subtitle" ? styles.subtitle : undefined,
                type === "link" ? styles.link : undefined,
                type === "hero" ? { fontSize: 48, fontWeight: "bold", color: ThemedColor.header } : undefined,
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
        color: ThemedColor.caption,
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
    heading: {
        fontSize: 32,
        fontWeight: 600,
        lineHeight: 36,
        fontFamily: "Outfit",
    },
    title: {
        fontSize: 32,
        fontWeight: "medium",
        lineHeight: 32,
        fontFamily: "Outfit",
    },
    subtitle: {
        fontSize: 20,
        fontWeight: 500,
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
        color: ThemedColor.text,
        fontFamily: "Outfit",
    },
});

/* eslint-disable import/no-unresolved */
import { Text, type TextProps, StyleSheet } from "react-native";

import { useThemeColor } from "@/hooks/useThemeColor";
import React from "react";

export type ThemedTextProps = TextProps & {
    lightColor?: string;
    darkColor?: string;
    type?:
        | "default"
        | "heading"
        | "title"
        | "defaultSemiBold"
        | "subtitle"
        | "link"
        | "hero"
        | "lightBody"
        | "caption"
        | "disabledTitle";
};

export function ThemedText({ style, lightColor, darkColor, type = "default", ...rest }: ThemedTextProps) {
    let ThemedColor = useThemeColor();
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
                type === "disabledTitle" ? styles.disabledTitle : undefined,
                style,
            ]}
            {...rest}
        />
    );
}
let ThemedColor = useThemeColor();

const styles = StyleSheet.create({
    default: {
        fontSize: 16,
        fontFamily: "Outfit",
    },
    disabledTitle: {
        fontSize: 20,
        fontWeight: "medium",
        color: ThemedColor.caption,
        fontFamily: "Outfit",
        opacity: 0.5,
    },
    caption: {
        fontSize: 14,
        fontFamily: "Outfit",
        color: ThemedColor.caption,
    },
    lightBody: {
        fontSize: 16,
        fontFamily: "Outfit",
        fontWeight: 400,
    },
    defaultSemiBold: {
        fontSize: 20,
        fontWeight: "regular",
        fontFamily: "Outfit",
    },
    heading: {
        fontSize: 32,
        fontWeight: 600,
        fontFamily: "Outfit",
    },
    title: {
        fontSize: 32,
        fontWeight: "medium",
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

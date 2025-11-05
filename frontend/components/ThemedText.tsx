/* eslint-disable import/no-unresolved */
import { Text, type TextProps, StyleSheet, Dimensions } from "react-native";

import { useThemeColor } from "@/hooks/useThemeColor";
import React from "react";

export type ThemedTextProps = TextProps & {
    lightColor?: string;
    darkColor?: string;
    type?:
        | "default"
        | "heading"
        | "fancyFrauncesHeading"
        | "title"
        | "defaultSemiBold"
        | "subtitle"
        | "link"
        | "hero"
        | "lightBody"
        | "caption"
        | "disabledTitle"
        | "smallerDefault"
        | "titleFraunces"
        | "subtitle_subtle"
        | "larger_default"
        | "larger_default_light";
};

export function ThemedText({ style, lightColor, darkColor, type = "default", ...rest }: ThemedTextProps) {
    let ThemedColor = useThemeColor();
    const color = ThemedColor.text;
    const base = 393;
    const scale = Dimensions.get("screen").width / base;
    const styles = useStyles(ThemedColor, scale);

    let useStyledHeader = true;

    return (
        <Text
            style={[
                { color },
                type === "default" ? styles.default : undefined,
                type === "title" ? (useStyledHeader ? styles.titleFraunces : styles.title) : undefined,
                type === "titleFraunces" ? styles.titleFraunces : undefined,
                type === "heading" ? styles.heading : undefined,
                type === "fancyFrauncesHeading" ? styles.fancyFrauncesHeading : undefined,
                type === "defaultSemiBold" ? styles.defaultSemiBold : undefined,
                type === "subtitle" ? styles.subtitle : undefined,
                type === "link" ? styles.link : undefined,
                type === "hero" ? { fontSize: 48, fontWeight: "bold", color: ThemedColor.header } : undefined,
                type === "lightBody" ? styles.lightBody : undefined,
                type === "caption" ? styles.caption : undefined,
                type === "disabledTitle" ? styles.disabledTitle : undefined,
                type === "smallerDefault" ? styles.smallerDefault : undefined,
                type === "subtitle_subtle" ? styles.subtitle_subtle : undefined,
                type === "larger_default" ? styles.larger_default : undefined,
                type === "larger_default_light" ? styles.larger_default_light : undefined,

                style,
            ]}
            {...rest}
        />
    );
}
let ThemedColor = useThemeColor();

const useStyles = (ThemedColor: any, scale: number) =>
    StyleSheet.create({
        default: {
            fontSize: 16 * scale,
            fontFamily: "OutfitLight",
        },
        disabledTitle: {
            fontSize: 20 * scale,
            fontWeight: "medium",
            color: ThemedColor.caption,
            fontFamily: "Outfit",
            opacity: 0.5,
        },
        caption: {
            fontSize: 14 * scale,
            fontFamily: "Outfit",
            fontWeight: "light",
            color: ThemedColor.caption,
        },
        lightBody: {
            fontSize: 16 * scale,
            fontFamily: "OutfitLight",
        },
        defaultSemiBold: {
            fontSize: 16 * scale,
            fontWeight: "regular",
            fontFamily: "Outfit",
        },
        heading: {
            fontSize: 32 * scale,
            fontWeight: 600,
            fontFamily: "Outfit",
            letterSpacing: -1,
        },
        fancyFrauncesHeading: {
            fontSize: 32 * scale,
            fontWeight: 600,
            fontFamily: "Fraunces",
            letterSpacing: -1,
        },
        title: {
            fontSize: 36 * scale,
            fontWeight: 600,
            // fontFamily: "Fraunces",
            fontFamily: "Outfit",
            letterSpacing: -1,
        },
        titleFraunces: {
            fontSize: 32 * scale,
            fontWeight: 600,
            fontFamily: "Fraunces",
            letterSpacing: -2,
            // lineHeight: 36 * scale,
        },
        subtitle: {
            fontSize: 20 * scale,
            fontWeight: 500,
            fontFamily: "Outfit",
        },
        link: {
            lineHeight: 30 * scale,
            fontSize: 16 * scale,
            color: "#444444",
            fontFamily: "Outfit",
        },
        tiny: {
            fontSize: 12 * scale,
            color: ThemedColor.text,
            fontFamily: "OutfitLight",
        },
        smallerDefault: {
            fontSize: 14 * scale,
            fontWeight: "400",
            fontFamily: "OutfitLight",
        },
        subtitle_subtle: {
            fontSize: 14 * scale,
            fontWeight: "500",
            fontFamily: "Outfit",
            color: ThemedColor.caption,
            opacity: 1,
            paddingVertical: 16,
        },
        larger_default: {
            fontSize: 17 * scale,
            fontWeight: "regular",
            fontFamily: "Outfit",
        },
        larger_default_light: {
            fontSize: 17 * scale,
            fontWeight: "regular",
            fontFamily: "Outfit",
            color: ThemedColor.caption,
        },
    });

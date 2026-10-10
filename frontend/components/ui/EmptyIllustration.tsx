import React from "react";
import { Image, type ImageSourcePropType, type ImageStyle, type StyleProp, useColorScheme } from "react-native";

type Props = {
    source: ImageSourcePropType;
    size?: number;
    /** Turn off for art with gray fills, which a white tint would flatten. */
    tintInDark?: boolean;
    style?: StyleProp<ImageStyle>;
};

// Black line art: tinted white in dark mode.
export function EmptyIllustration({ source, size = 240, tintInDark = true, style }: Props) {
    const isDark = useColorScheme() === "dark";
    return (
        <Image
            source={source}
            resizeMode="contain"
            style={[{ width: size, height: size, alignSelf: "center" }, isDark && tintInDark && { tintColor: "#ffffff" }, style]}
        />
    );
}

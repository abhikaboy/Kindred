import React, { useState } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import { Key, Robot } from "phosphor-react-native";
import { useThemeColor } from "@/hooks/useThemeColor";

type Props = {
    logoUri?: string | null;
    size?: number;
    /** Personal access tokens get a key instead of an app logo. */
    token?: boolean;
};

/** Leading mark for an assistant: its logo when it has one, otherwise a quiet icon on a primary tint. */
export default function AssistantMark({ logoUri, size = 40, token = false }: Props) {
    const ThemedColor = useThemeColor();
    const [failed, setFailed] = useState(false);
    const radius = size / 2;

    if (logoUri && !failed && !token) {
        return (
            <Image
                source={{ uri: logoUri }}
                style={{ width: size, height: size, borderRadius: radius, backgroundColor: ThemedColor.lightened }}
                contentFit="cover"
                onError={() => setFailed(true)}
                accessibilityIgnoresInvertColors
            />
        );
    }

    const Icon = token ? Key : Robot;
    return (
        <View
            style={{
                width: size,
                height: size,
                borderRadius: radius,
                backgroundColor: ThemedColor.primary + "14",
                alignItems: "center",
                justifyContent: "center",
            }}>
            <Icon size={size / 2} color={ThemedColor.primary} weight="regular" />
        </View>
    );
}

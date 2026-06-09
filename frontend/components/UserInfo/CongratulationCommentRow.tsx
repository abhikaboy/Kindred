import React from "react";
import { View, StyleSheet } from "react-native";
import { Confetti } from "phosphor-react-native";
import { ThemedText } from "../ThemedText";
import PreviewIcon from "../profile/PreviewIcon";
import CachedImage from "../CachedImage";
import { useThemeColor } from "@/hooks/useThemeColor";

type Props = {
    name: string;
    message: string;
    icon: string;
    time?: string;
    // "image" => message holds an image/GIF URL; otherwise it's text.
    type?: string;
};

// A congratulation rendered inline in a post's comment thread. Distinct from a
// normal comment: confetti accent + primary "congratulated" label, no reply.
const CongratulationCommentRow = ({ name, message, icon, time, type }: Props) => {
    const ThemedColor = useThemeColor();
    const isImage = type === "image";

    return (
        <View style={styles.container}>
            <View style={{ paddingTop: 8 }}>
                <PreviewIcon size={"smallMedium"} icon={icon} />
            </View>
            <View style={{ gap: 2, flex: 1 }}>
                <View style={{ flexDirection: "row", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <Confetti size={14} weight="fill" color={ThemedColor.primary} />
                    <ThemedText type="caption" style={{ color: ThemedColor.primary }}>
                        {name || "Someone"} sent a congratulations
                    </ThemedText>
                    {time !== undefined && (
                        <ThemedText type="caption" style={{ color: ThemedColor.caption }}>
                            {time}
                        </ThemedText>
                    )}
                </View>
                {message ? (
                    isImage ? (
                        <CachedImage
                            source={{ uri: message }}
                            style={styles.image}
                            contentFit="cover"
                            cachePolicy="memory-disk"
                        />
                    ) : (
                        <ThemedText type="default" style={[styles.message, { color: ThemedColor.text }]}>
                            {message}
                        </ThemedText>
                    )
                ) : null}
            </View>
        </View>
    );
};

export default CongratulationCommentRow;

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        gap: 12,
        alignItems: "flex-start",
        width: "100%",
    },
    message: {
        flexWrap: "wrap",
        width: "100%",
        flexShrink: 1,
        lineHeight: 20,
    },
    image: {
        width: 160,
        height: 160,
        borderRadius: 12,
        marginTop: 2,
    },
});

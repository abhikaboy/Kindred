import React from "react";
import { View, StyleSheet } from "react-native";
import CachedImage from "../CachedImage";
import { encouragedCardColors } from "./encouragedTask";
import type { PostKudos } from "@/api/types";

// An overlapping stack of the avatars of users who congratulated a post — the
// post-side mirror of EncouragerAvatars. The avatars carry the same soft
// primary glow as the encouraged-task state (here scoped to the icons, not
// the whole card). Caps at MAX to bound width.
const SIZE = 22;
const MAX = 3;

type Props = {
    kudos: PostKudos[];
    ringColor: string;
    placeholderColor: string;
    glowColor: string;
};

const KudosAvatars = ({ kudos, ringColor, placeholderColor, glowColor }: Props) => {
    const shown = kudos.slice(0, MAX);
    const glow = encouragedCardColors(glowColor).glow;
    return (
        <View style={styles.row}>
            {shown.map((k, i) => {
                const style = [
                    styles.avatar,
                    glow,
                    {
                        borderColor: ringColor,
                        marginLeft: i === 0 ? 0 : -SIZE / 2.5,
                        zIndex: shown.length - i,
                    },
                ];
                return k.sender.icon ? (
                    <CachedImage
                        key={k.congratulationId}
                        source={{ uri: k.sender.icon }}
                        style={style}
                        variant="thumbnail"
                        cachePolicy="memory-disk"
                    />
                ) : (
                    <View key={k.congratulationId} style={[style, { backgroundColor: placeholderColor }]} />
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    row: {
        flexDirection: "row",
        alignItems: "center",
    },
    avatar: {
        width: SIZE,
        height: SIZE,
        borderRadius: SIZE / 2,
        borderWidth: 1.5,
    },
});

export default KudosAvatars;

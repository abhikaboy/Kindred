import React from "react";
import { View, StyleSheet } from "react-native";
import CachedImage from "../CachedImage";
import type { PostKudos } from "@/api/types";

// An overlapping stack of the avatars of users who congratulated a post — the
// post-side mirror of EncouragerAvatars. Each avatar carries a soft primary
// glow (the encouraged-task accent, scoped to the icons). The glow lives on a
// wrapping View, not the image: expo-image doesn't reliably render shadow
// props, and iOS needs an opaque surface to cast from.
const SIZE = 28;
const MAX = 3;

type Props = {
    kudos: PostKudos[];
    ringColor: string;
    placeholderColor: string;
    glowColor: string;
};

const KudosAvatars = ({ kudos, ringColor, placeholderColor, glowColor }: Props) => {
    const shown = kudos.slice(0, MAX);
    return (
        <View style={styles.row}>
            {shown.map((k, i) => (
                <View
                    key={k.congratulationId}
                    style={[
                        styles.glowWrap,
                        {
                            backgroundColor: ringColor,
                            shadowColor: glowColor,
                            marginLeft: i === 0 ? 0 : -SIZE / 2.5,
                            zIndex: shown.length - i,
                        },
                    ]}>
                    {k.sender.icon ? (
                        <CachedImage
                            source={{ uri: k.sender.icon }}
                            style={[styles.avatar, { borderColor: ringColor }]}
                            variant="thumbnail"
                            cachePolicy="memory-disk"
                        />
                    ) : (
                        <View style={[styles.avatar, { borderColor: ringColor, backgroundColor: placeholderColor }]} />
                    )}
                </View>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    row: {
        flexDirection: "row",
        alignItems: "center",
    },
    // Carries the glow; sized to the avatar so the shadow halos the circle.
    glowWrap: {
        width: SIZE,
        height: SIZE,
        borderRadius: SIZE / 2,
        shadowOpacity: 0.6,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 0 },
        elevation: 6,
    },
    avatar: {
        width: SIZE,
        height: SIZE,
        borderRadius: SIZE / 2,
        borderWidth: 1.5,
    },
});

export default KudosAvatars;

import React from "react";
import { View, StyleSheet } from "react-native";
import CachedImage from "../CachedImage";
import type { TaskKudos } from "@/api/types";

// A small overlapping stack of the avatars of users who encouraged a task,
// shown on the encouraged task card. Caps at MAX to bound width.
const SIZE = 22;
const MAX = 3;

type Props = {
    encouragements: TaskKudos[];
    ringColor: string;
    placeholderColor: string;
};

const EncouragerAvatars = ({ encouragements, ringColor, placeholderColor }: Props) => {
    const shown = encouragements.slice(0, MAX);
    return (
        <View style={styles.row}>
            {shown.map((k, i) => {
                const style = [
                    styles.avatar,
                    {
                        borderColor: ringColor,
                        marginLeft: i === 0 ? 0 : -SIZE / 2.5,
                        zIndex: shown.length - i,
                    },
                ];
                return k.sender.icon ? (
                    <CachedImage
                        key={k.encouragementId}
                        source={{ uri: k.sender.icon }}
                        style={style}
                        variant="thumbnail"
                        cachePolicy="memory-disk"
                    />
                ) : (
                    <View key={k.encouragementId} style={[style, { backgroundColor: placeholderColor }]} />
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

export default EncouragerAvatars;

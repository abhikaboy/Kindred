import React from "react";
import { View, StyleSheet } from "react-native";
import CachedImage from "../CachedImage";
import type { TaskKudos, TaggedTaskUser } from "@/api/types";

// A small overlapping stack of the avatars of users who encouraged a task,
// shown on the encouraged task card. Caps at MAX to bound width.
const SIZE = 22;
const MAX = 3;

type AvatarEntry = { key: string; uri?: string };

type Props = {
    encouragements: TaskKudos[];
    taggedUsers?: TaggedTaskUser[];
    ringColor: string;
    placeholderColor: string;
};

const EncouragerAvatars = ({ encouragements, taggedUsers = [], ringColor, placeholderColor }: Props) => {
    // Build a merged, de-duplicated avatar list. Kudos senders win on conflict.
    const seenIds = new Set<string>();
    const merged: AvatarEntry[] = [];

    for (const k of encouragements) {
        const id = k.sender.id;
        if (!seenIds.has(id)) {
            seenIds.add(id);
            merged.push({ key: k.encouragementId, uri: k.sender.icon ?? undefined });
        }
    }

    for (const t of taggedUsers) {
        if ((t.status === "pending" || t.status === "watching") && !seenIds.has(t.id)) {
            seenIds.add(t.id);
            merged.push({ key: t.id, uri: t.profile_picture ?? undefined });
        }
    }

    const shown = merged.slice(0, MAX);
    return (
        <View style={styles.row}>
            {shown.map((entry, i) => {
                const style = [
                    styles.avatar,
                    {
                        borderColor: ringColor,
                        marginLeft: i === 0 ? 0 : -SIZE / 2.5,
                        zIndex: shown.length - i,
                    },
                ];
                return entry.uri ? (
                    <CachedImage
                        key={entry.key}
                        source={{ uri: entry.uri }}
                        style={style}
                        variant="thumbnail"
                        cachePolicy="memory-disk"
                    />
                ) : (
                    <View key={entry.key} style={[style, { backgroundColor: placeholderColor }]} />
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

import React, { useState } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { BottomSheetFlatList } from "@gorhom/bottom-sheet";
import { router, type Href } from "expo-router";
import { Play, User } from "phosphor-react-native";
import KudosVideoPlayerModal from "./KudosVideoPlayerModal";
import { ThemedText } from "@/components/ThemedText";
import DefaultModal from "./DefaultModal";
import CachedImage from "@/components/CachedImage";
import { useThemeColor } from "@/hooks/useThemeColor";
import type { PostKudos } from "@/api/types";

// Private congrats arrive without a sender for non-owners; render anonymously.
const isAnon = (k: PostKudos) => !!k.private && !k.sender?.name;

interface Props {
    visible: boolean;
    setVisible: (visible: boolean) => void;
    kudos: PostKudos[];
}

// The "who congratulated" list for a post. Mirrors ReactionsBottomSheetModal
// but reads from the post's denormalized kudos array (no fetch) and shows each
// congratulator's message rather than a handle.
export default function CongratulatorsBottomSheetModal({ visible, setVisible, kudos }: Props) {
    const ThemedColor = useThemeColor();
    const styles = createStyles(ThemedColor);
    const [playingUri, setPlayingUri] = useState<string | null>(null);

    return (
        <DefaultModal visible={visible} setVisible={setVisible}>
            <View style={styles.container}>
                <ThemedText type="subtitle" style={styles.title}>Congratulations</ThemedText>

                <BottomSheetFlatList
                    data={kudos}
                    keyExtractor={(k) => k.congratulationId}
                    renderItem={({ item }) => {
                        const anon = isAnon(item);
                        return (
                            <TouchableOpacity
                                style={styles.row}
                                disabled={anon}
                                onPress={() => {
                                    if (anon) return;
                                    setVisible(false);
                                    if (item.sender.id) router.push(`/account/${item.sender.id}` as Href);
                                }}>
                                {anon ? (
                                    <View style={[styles.avatar, styles.anon, { backgroundColor: ThemedColor.tertiary }]}>
                                        <User size={22} color={ThemedColor.caption} weight="fill" />
                                    </View>
                                ) : item.sender.icon ? (
                                    <CachedImage
                                        source={{ uri: item.sender.icon }}
                                        variant="thumbnail"
                                        cachePolicy="memory-disk"
                                        style={styles.avatar}
                                    />
                                ) : (
                                    <View style={[styles.avatar, { backgroundColor: ThemedColor.tertiary }]} />
                                )}
                                <View style={{ flex: 1 }}>
                                    <ThemedText type="defaultSemiBold" numberOfLines={1}>
                                        {anon ? "Anonymous" : item.sender.name}
                                    </ThemedText>
                                    {!anon && item.message ? (
                                        item.type === "video" && item.thumbnailUrl ? (
                                            <TouchableOpacity
                                                onPress={() => setPlayingUri(item.message)}
                                                activeOpacity={0.8}
                                                style={styles.kudosVideoWrap}>
                                                <CachedImage
                                                    source={{ uri: item.thumbnailUrl }}
                                                    contentFit="cover"
                                                    cachePolicy="memory-disk"
                                                    style={styles.kudosImage}
                                                />
                                                <View style={styles.playBadge}>
                                                    <Play size={14} color="#fff" weight="fill" />
                                                </View>
                                            </TouchableOpacity>
                                        ) : item.type === "image" ? (
                                            <CachedImage
                                                source={{ uri: item.message }}
                                                contentFit="cover"
                                                cachePolicy="memory-disk"
                                                style={styles.kudosImage}
                                            />
                                        ) : (
                                            <ThemedText type="caption" style={{ color: ThemedColor.caption }} numberOfLines={2}>
                                                {item.message}
                                            </ThemedText>
                                        )
                                    ) : null}
                                </View>
                            </TouchableOpacity>
                        );
                    }}
                />
            </View>
            {/* RN Modal from inside a gorhom sheet — pending on-device verification. */}
            {playingUri ? <KudosVideoPlayerModal uri={playingUri} onClose={() => setPlayingUri(null)} /> : null}
        </DefaultModal>
    );
}

const createStyles = (ThemedColor: ReturnType<typeof useThemeColor>) =>
    StyleSheet.create({
        container: { paddingBottom: 16, gap: 12, minHeight: 200 },
        title: { marginBottom: 4 },
        row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
        avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: ThemedColor.tertiary },
        anon: { alignItems: "center", justifyContent: "center" },
        kudosImage: { width: 120, height: 120, borderRadius: 10, marginTop: 4 },
        kudosVideoWrap: { position: "relative", alignSelf: "flex-start" },
        playBadge: {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
        },
    });

import React, { useEffect, useState } from "react";
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { BottomSheetFlatList } from "@gorhom/bottom-sheet";
import { router, type Href } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import DefaultModal from "./DefaultModal";
import CachedImage from "@/components/CachedImage";
import { useThemeColor } from "@/hooks/useThemeColor";
import type { ReactionGroup } from "@/utils/reactions";

interface Props {
    visible: boolean;
    setVisible: (visible: boolean) => void;
    groups: ReactionGroup[];
    initialEmoji?: string;
    loading: boolean;
    error?: string | null;
    onRetry?: () => void;
}

export default function ReactionsBottomSheetModal({
    visible,
    setVisible,
    groups,
    initialEmoji,
    loading,
    error,
    onRetry,
}: Props) {
    const ThemedColor = useThemeColor();
    const styles = createStyles(ThemedColor);
    const [selected, setSelected] = useState(initialEmoji);

    useEffect(() => {
        if (visible) setSelected(initialEmoji ?? groups[0]?.emoji);
    }, [visible, initialEmoji, groups]);

    const active = groups.find((g) => g.emoji === selected) ?? groups[0];

    return (
        <DefaultModal visible={visible} setVisible={setVisible}>
            <View style={styles.container}>
                <ThemedText type="subtitle" style={styles.title}>Reactions</ThemedText>

                <View style={styles.chipRow}>
                    {groups.map((g) => {
                        const isActive = g.emoji === active?.emoji;
                        return (
                            <TouchableOpacity
                                key={g.emoji}
                                onPress={() => setSelected(g.emoji)}
                                style={[
                                    styles.chip,
                                    { borderColor: isActive ? ThemedColor.primary : ThemedColor.tertiary,
                                      backgroundColor: isActive ? ThemedColor.primary + "20" : "transparent" },
                                ]}>
                                <ThemedText style={styles.chipText}>{g.emoji} {g.count}</ThemedText>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {loading ? (
                    <ActivityIndicator color={ThemedColor.text} style={{ marginVertical: 24 }} />
                ) : error ? (
                    <TouchableOpacity onPress={onRetry} style={{ marginVertical: 24, alignItems: "center" }}>
                        <ThemedText style={{ color: ThemedColor.caption }}>{error} — tap to retry</ThemedText>
                    </TouchableOpacity>
                ) : (
                    <BottomSheetFlatList
                        data={active?.users ?? []}
                        keyExtractor={(u) => u._id}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.row}
                                onPress={() => {
                                    setVisible(false);
                                    router.push(`/account/${item._id}` as Href);
                                }}>
                                <CachedImage
                                    source={{ uri: item.profile_picture }}
                                    variant="thumbnail"
                                    cachePolicy="memory-disk"
                                    style={styles.avatar}
                                />
                                <View style={{ flex: 1 }}>
                                    <ThemedText type="defaultSemiBold" numberOfLines={1}>{item.display_name}</ThemedText>
                                    <ThemedText type="caption" style={{ color: ThemedColor.caption }} numberOfLines={1}>
                                        {item.handle}
                                    </ThemedText>
                                </View>
                            </TouchableOpacity>
                        )}
                    />
                )}
            </View>
        </DefaultModal>
    );
}

const createStyles = (ThemedColor: ReturnType<typeof useThemeColor>) =>
    StyleSheet.create({
        container: { paddingHorizontal: 20, paddingBottom: 16, gap: 12, minHeight: 200 },
        title: { marginBottom: 4 },
        chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
        chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
        chipText: { fontSize: 14 },
        row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
        avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: ThemedColor.tertiary },
    });

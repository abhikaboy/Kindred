import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { BottomSheetFlatList } from "@gorhom/bottom-sheet";
import { router, type Href } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import DefaultModal from "./DefaultModal";
import CachedImage from "@/components/CachedImage";
import { useThemeColor } from "@/hooks/useThemeColor";
import type { PostKudos } from "@/api/types";

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

    return (
        <DefaultModal visible={visible} setVisible={setVisible}>
            <View style={styles.container}>
                <ThemedText type="subtitle" style={styles.title}>Congratulations</ThemedText>

                <BottomSheetFlatList
                    data={kudos}
                    keyExtractor={(k) => k.congratulationId}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={styles.row}
                            onPress={() => {
                                setVisible(false);
                                if (item.sender.id) router.push(`/account/${item.sender.id}` as Href);
                            }}>
                            {item.sender.icon ? (
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
                                    {item.sender.name}
                                </ThemedText>
                                {item.message ? (
                                    item.type === "image" ? (
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
                    )}
                />
            </View>
        </DefaultModal>
    );
}

const createStyles = (ThemedColor: ReturnType<typeof useThemeColor>) =>
    StyleSheet.create({
        container: { paddingHorizontal: 20, paddingBottom: 16, gap: 12, minHeight: 200 },
        title: { marginBottom: 4 },
        row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
        avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: ThemedColor.tertiary },
        kudosImage: { width: 120, height: 120, borderRadius: 10, marginTop: 4 },
    });

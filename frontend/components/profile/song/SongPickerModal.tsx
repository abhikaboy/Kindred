import React, { useEffect, useState } from "react";
import { Modal, View, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { MagnifyingGlass, MusicNote, X, Play, Pause, PlusCircle } from "phosphor-react-native";
import { searchSongs, type Song } from "@/api/itunes";
import Equalizer from "./Equalizer";

export default function SongPickerModal({
    visible,
    onClose,
    onSelect,
}: {
    visible: boolean;
    onClose: () => void;
    onSelect: (song: Song) => void;
}) {
    const ThemedColor = useThemeColor();
    const [term, setTerm] = useState("");
    const [results, setResults] = useState<Song[]>([]);
    const [loading, setLoading] = useState(false);
    const [previewId, setPreviewId] = useState<number | null>(null);

    // One shared player for the whole list — tapping a row swaps its source
    // rather than mounting a player per result.
    const player = useVideoPlayer(null, (p) => {
        p.loop = true;
    });

    // Debounced search straight to the public iTunes API — no backend needed.
    // Any in-flight preview stops when the query changes.
    useEffect(() => {
        player.pause();
        setPreviewId(null);
        if (!term.trim()) {
            setResults([]);
            return;
        }
        const controller = new AbortController();
        const handle = setTimeout(async () => {
            setLoading(true);
            try {
                setResults(await searchSongs(term, controller.signal));
            } catch {
                if (!controller.signal.aborted) setResults([]);
            } finally {
                setLoading(false);
            }
        }, 350);
        return () => {
            clearTimeout(handle);
            controller.abort();
        };
    }, [term, player]);

    // Never let a preview leak past a dismiss.
    useEffect(() => {
        if (!visible) {
            player.pause();
            setPreviewId(null);
        }
    }, [visible, player]);

    const togglePreview = (song: Song) => {
        if (previewId === song.id) {
            player.pause();
            setPreviewId(null);
            return;
        }
        setPreviewId(song.id);
        player.replaceAsync(song.previewUrl).then(() => player.play());
    };

    const pick = (song: Song) => {
        player.pause();
        setPreviewId(null);
        onSelect(song);
        setTerm("");
        setResults([]);
        onClose();
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={[styles.container, { backgroundColor: ThemedColor.background }]}>
                <View style={styles.header}>
                    <ThemedText type="fancyFrauncesSubheading">Add a song</ThemedText>
                    <TouchableOpacity onPress={onClose} hitSlop={12}>
                        <X size={24} color={ThemedColor.text} weight="bold" />
                    </TouchableOpacity>
                </View>

                <View style={[styles.searchBar, { backgroundColor: ThemedColor.lightened }]}>
                    <MagnifyingGlass size={18} color={ThemedColor.caption} />
                    <TextInput
                        value={term}
                        onChangeText={setTerm}
                        placeholder="Search songs or artists"
                        placeholderTextColor={ThemedColor.caption}
                        style={[styles.input, { color: ThemedColor.text }]}
                        autoFocus
                        returnKeyType="search"
                        autoCorrect={false}
                    />
                </View>

                {loading && <ActivityIndicator color={ThemedColor.primary} style={styles.spinner} />}

                <FlatList
                    data={results}
                    keyExtractor={(item) => String(item.id)}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={styles.listContent}
                    renderItem={({ item }) => {
                        const previewing = previewId === item.id;
                        return (
                            <View style={[styles.row, { borderBottomColor: ThemedColor.tertiary }]}>
                                <TouchableOpacity
                                    style={styles.rowMain}
                                    onPress={() => togglePreview(item)}
                                    activeOpacity={0.7}>
                                    <View style={[styles.rowArt, { backgroundColor: ThemedColor.lightened }]}>
                                        {item.artworkUrl ? (
                                            <Image
                                                source={{ uri: item.artworkUrl }}
                                                style={StyleSheet.absoluteFill}
                                                contentFit="cover"
                                            />
                                        ) : (
                                            <MusicNote size={18} color={ThemedColor.caption} weight="fill" />
                                        )}
                                        <View style={styles.playOverlay}>
                                            {previewing ? (
                                                <Pause size={14} color="#fff" weight="fill" />
                                            ) : (
                                                <Play size={14} color="#fff" weight="fill" />
                                            )}
                                        </View>
                                    </View>
                                    <View style={styles.rowText}>
                                        <ThemedText type="defaultSemiBold" numberOfLines={1}>
                                            {item.title}
                                        </ThemedText>
                                        <ThemedText type="caption" numberOfLines={1}>
                                            {item.artist}
                                        </ThemedText>
                                    </View>
                                    {previewing && <Equalizer playing color={ThemedColor.primary} size={14} />}
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => pick(item)}
                                    hitSlop={8}
                                    style={styles.addBtn}
                                    activeOpacity={0.7}
                                    accessibilityLabel={`Use ${item.title}`}>
                                    <PlusCircle size={28} color={ThemedColor.primary} weight="fill" />
                                </TouchableOpacity>
                            </View>
                        );
                    }}
                    ListEmptyComponent={
                        !loading && term.trim() ? (
                            <ThemedText type="caption" style={styles.empty}>
                                No results
                            </ThemedText>
                        ) : null
                    }
                />

                <VideoView player={player} style={styles.hiddenVideo} />
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 40,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 20,
    },
    searchBar: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 48,
    },
    input: {
        flex: 1,
        fontFamily: "Outfit",
        fontSize: 16,
    },
    spinner: {
        marginTop: 16,
    },
    listContent: {
        paddingBottom: 40,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        borderBottomWidth: 0.5,
    },
    rowMain: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 10,
    },
    rowArt: {
        width: 44,
        height: 44,
        borderRadius: 6,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
    },
    playOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.25)",
    },
    rowText: {
        flex: 1,
        gap: 2,
    },
    addBtn: {
        paddingLeft: 12,
        paddingVertical: 10,
    },
    empty: {
        marginTop: 24,
    },
    hiddenVideo: {
        width: 1,
        height: 1,
        opacity: 0,
        position: "absolute",
    },
});

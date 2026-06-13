import React, { useEffect, useState } from "react";
import { Modal, View, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { MagnifyingGlass, X } from "phosphor-react-native";
import { searchSongs, type Song } from "@/api/itunes";

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

    // Debounced search straight to the public iTunes API — no backend needed.
    useEffect(() => {
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
    }, [term]);

    const pick = (song: Song) => {
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
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={[styles.row, { borderBottomColor: ThemedColor.tertiary }]}
                            onPress={() => pick(item)}
                            activeOpacity={0.7}>
                            <ThemedText type="defaultSemiBold" numberOfLines={1}>
                                {item.title}
                            </ThemedText>
                            <ThemedText type="caption" numberOfLines={1}>
                                {item.artist}
                            </ThemedText>
                        </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                        !loading && term.trim() ? (
                            <ThemedText type="caption" style={styles.empty}>
                                No results
                            </ThemedText>
                        ) : null
                    }
                />
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 20,
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
        paddingVertical: 14,
        borderBottomWidth: 0.5,
        gap: 2,
    },
    empty: {
        marginTop: 24,
    },
});

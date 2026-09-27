import React, { useMemo, useState } from "react";
import { StyleSheet, TextInput, TouchableOpacity, View, useColorScheme } from "react-native";
import { Check, MagnifyingGlass, X } from "phosphor-react-native";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/ThemedText";
import PreviewIcon from "@/components/profile/PreviewIcon";
import CachedImage from "@/components/CachedImage";
import { SectionTitle } from "@/components/dashboard/SectionHeader";
import { STAGE } from "@/components/capture/CaptureStage";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useFriendsForMention, type MentionCandidate } from "@/hooks/useFriendsForMention";
import { useTaskCreation } from "@/contexts/taskCreationContext";
import { formatHandle } from "@/utils/handle";

// Rows are plain Views inside the top area's ScrollView, so keep the list bounded
const MAX_ROWS = 40;

/** Profile picture, or the first letter on a quiet disc when there isn't one. */
const Avatar = ({ uri, name, size }: { uri?: string; name: string; size: number }) =>
    uri ? (
        size >= 35 ? (
            <PreviewIcon icon={uri} size="small" />
        ) : (
            <CachedImage
                source={{ uri }}
                style={{ width: size, height: size, borderRadius: size / 2 }}
                variant="thumbnail"
                cachePolicy="memory-disk"
            />
        )
    ) : (
        <View
            style={[
                styles.initial,
                { width: size, height: size, borderRadius: size / 2, backgroundColor: STAGE.fillRaised },
            ]}>
            <ThemedText type="caption" style={{ color: STAGE.text }}>
                {(name.trim()[0] ?? "?").toUpperCase()}
            </ThemedText>
        </View>
    );

/**
 * Tag friends on the dark stage, built like the app's other friend lists: the
 * avatar / name / handle row from UserInfoRowBase and the avatar + handle chips
 * from TaggedUsersChips. Toggling writes straight to the task; Done closes.
 */
const TagPanel = ({ onDone }: { onDone: () => void }) => {
    const ThemedColor = useThemeColor();
    const scheme = useColorScheme() === "dark" ? "dark" : "light";
    const { taggedUsers, setTaggedUsers } = useTaskCreation();
    const { friends, filter, loading } = useFriendsForMention();
    const [query, setQuery] = useState("");
    const matches = useMemo(() => filter(query).slice(0, MAX_ROWS), [filter, query]);
    const tagged = new Set(taggedUsers.map((u) => u.id));

    const toggle = (f: MentionCandidate) => {
        Haptics.selectionAsync();
        if (tagged.has(f.id)) {
            setTaggedUsers(taggedUsers.filter((u) => u.id !== f.id));
        } else {
            setTaggedUsers([
                ...taggedUsers,
                { id: f.id, handle: f.handle, display_name: f.display_name, profile_picture: f.profile_picture },
            ]);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <SectionTitle title="Tag friends" style={{ color: STAGE.text }} />
                <TouchableOpacity onPress={onDone} hitSlop={8} accessibilityRole="button">
                    <ThemedText type="defaultSemiBold" style={{ color: STAGE.text }}>
                        Done
                    </ThemedText>
                </TouchableOpacity>
            </View>
            <ThemedText type="caption" style={{ color: STAGE.muted, marginTop: -8 }}>
                They'll get a notification and can copy it to their own list.
            </ThemedText>

            {taggedUsers.length > 0 && (
                <View style={styles.chips}>
                    {taggedUsers.map((u) => (
                        <View key={u.id} style={[styles.chip, { backgroundColor: STAGE.selected }]}>
                            <Avatar uri={u.profile_picture} name={u.display_name ?? u.handle} size={20} />
                            <ThemedText type="caption" style={{ color: STAGE.onSelected }}>
                                {formatHandle(u.handle)}
                            </ThemedText>
                            <TouchableOpacity
                                onPress={() => {
                                    Haptics.selectionAsync();
                                    setTaggedUsers(taggedUsers.filter((t) => t.id !== u.id));
                                }}
                                hitSlop={8}
                                accessibilityRole="button"
                                accessibilityLabel={`Untag ${formatHandle(u.handle)}`}>
                                <X size={12} color={STAGE.onSelected} weight="bold" />
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>
            )}

            <View style={[styles.search, { backgroundColor: STAGE.fill }]}>
                <MagnifyingGlass size={16} color={STAGE.muted} />
                <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search friends"
                    placeholderTextColor={STAGE.muted}
                    keyboardAppearance={scheme}
                    selectionColor={ThemedColor.primary}
                    autoCorrect={false}
                    autoCapitalize="none"
                    style={styles.searchInput}
                />
            </View>

            {!loading && friends.length === 0 ? (
                <ThemedText type="caption" style={{ color: STAGE.muted }}>
                    Add friends to tag them on tasks.
                </ThemedText>
            ) : !loading && matches.length === 0 ? (
                <ThemedText type="caption" style={{ color: STAGE.muted }}>
                    No friends match “{query.trim()}”
                </ThemedText>
            ) : (
                <View>
                    {matches.map((f) => {
                        const on = tagged.has(f.id);
                        return (
                            <TouchableOpacity
                                key={f.id}
                                onPress={() => toggle(f)}
                                style={styles.row}
                                accessibilityRole="checkbox"
                                accessibilityState={{ checked: on }}
                                accessibilityLabel={`${f.display_name}, ${formatHandle(f.handle)}`}>
                                <Avatar uri={f.profile_picture} name={f.display_name} size={35} />
                                <View style={styles.rowText}>
                                    <ThemedText type="default" numberOfLines={1} style={{ color: STAGE.text }}>
                                        {f.display_name}
                                    </ThemedText>
                                    <ThemedText type="caption" numberOfLines={1} style={{ color: STAGE.muted }}>
                                        {formatHandle(f.handle)}
                                    </ThemedText>
                                </View>
                                <View
                                    style={[
                                        styles.check,
                                        on
                                            ? { backgroundColor: STAGE.selected, borderColor: STAGE.selected }
                                            : { borderColor: STAGE.faint },
                                    ]}>
                                    {on && <Check size={14} color={STAGE.onSelected} weight="bold" />}
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            )}
        </View>
    );
};

export default TagPanel;

const styles = StyleSheet.create({
    container: { gap: 16 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingLeft: 4,
        paddingRight: 12,
        height: 28,
        borderRadius: 100,
    },
    initial: { alignItems: "center", justifyContent: "center" },
    search: { flexDirection: "row", alignItems: "center", gap: 8, height: 44, paddingHorizontal: 12, borderRadius: 12 },
    searchInput: { flex: 1, color: STAGE.text, fontSize: 16, fontFamily: "Outfit", paddingVertical: 0 },
    row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
    rowText: { flex: 1 },
    check: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 1.5,
        alignItems: "center",
        justifyContent: "center",
    },
});

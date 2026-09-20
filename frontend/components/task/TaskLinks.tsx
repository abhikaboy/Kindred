import React, { useMemo, useState } from "react";
import { View, TextInput, TouchableOpacity, Linking, StyleSheet } from "react-native";
import { LinkSimple, Plus, X } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { normalizeLink, syncNotesLinks, type TaskLink } from "@shared/taskLinks";
import { updateLinksAPI } from "@/api/task";
import { logger } from "@/utils/logger";

type TaskLinksProps = {
    categoryId: string;
    taskId: string;
    links: TaskLink[] | null | undefined;
    /**
     * The live notes text. Links typed into the notes are previewed from here so
     * they show up as soon as they're typed, rather than after the debounced
     * notes save round-trips.
     */
    notes: string;
    onLinksChange: (links: TaskLink[]) => void;
};

export default function TaskLinks({ categoryId, taskId, links, notes, onLinksChange }: TaskLinksProps) {
    const ThemedColor = useThemeColor();
    const [draft, setDraft] = useState("");

    const visibleLinks = useMemo(() => syncNotesLinks(links, notes), [links, notes]);

    // Only manual links are persisted directly; the notes-derived ones are
    // re-added server-side on the next notes save, so they'd come back anyway.
    const persist = async (next: TaskLink[]) => {
        onLinksChange(next);
        try {
            await updateLinksAPI(categoryId, taskId, next);
        } catch (error) {
            logger.error("Error updating task links", error);
        }
    };

    const handleAdd = () => {
        const link = normalizeLink(draft);
        if (!link) return;
        setDraft("");
        persist([...visibleLinks, link]);
    };

    const handleRemove = (url: string) => persist(visibleLinks.filter((link) => link.url !== url));

    return (
        <View style={{ gap: 8 }}>
            {visibleLinks.map((link) => (
                <View key={link.url} style={styles.row}>
                    <TouchableOpacity
                        style={styles.linkBody}
                        onPress={() => Linking.openURL(link.url).catch((e) => logger.error("Error opening link", e))}>
                        <LinkSimple size={16} color={ThemedColor.primary} weight="bold" />
                        <ThemedText type="smallerDefault" numberOfLines={1} style={{ flex: 1 }}>
                            {link.title || link.url}
                        </ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleRemove(link.url)} hitSlop={8}>
                        <X size={14} color={ThemedColor.caption} weight="bold" />
                    </TouchableOpacity>
                </View>
            ))}

            <View style={styles.row}>
                <TextInput
                    value={draft}
                    onChangeText={setDraft}
                    onSubmitEditing={handleAdd}
                    placeholder="Paste or type a link"
                    placeholderTextColor={ThemedColor.caption}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    returnKeyType="done"
                    style={[styles.input, { color: ThemedColor.text }]}
                />
                <TouchableOpacity onPress={handleAdd} disabled={!draft.trim()} hitSlop={8}>
                    <Plus size={16} color={draft.trim() ? ThemedColor.primary : ThemedColor.caption} weight="bold" />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    linkBody: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    input: {
        flex: 1,
        paddingVertical: 8,
        fontSize: 16,
        fontFamily: "OutfitLight",
    },
});

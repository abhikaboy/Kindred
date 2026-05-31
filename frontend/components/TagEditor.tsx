import React, { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { View, TouchableOpacity } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import ThemedInput from "@/components/inputs/ThemedInput";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { useThemeColor } from "@/hooks/useThemeColor";
import { getUserTags } from "@/api/category";
import TagChip from "@/components/TagChip";

const normalize = (t: string) => t.trim().toLowerCase();

export interface TagEditorHandle {
    /**
     * Commit any text still sitting in the input and return the resulting tag
     * list. Lets a host flush a typed-but-not-added tag when its own primary
     * action fires (e.g. "Save" / "+"), without it being silently dropped.
     */
    flush: () => string[];
}

interface TagEditorProps {
    tags: string[];
    onChange: (tags: string[]) => void;
    // Both current hosts present the editor inside a bottom sheet.
    useBottomSheetInput?: boolean;
}

const TagEditor = forwardRef<TagEditorHandle, TagEditorProps>(function TagEditor(
    { tags, onChange, useBottomSheetInput = true },
    ref
) {
    const ThemedColor = useThemeColor();
    const [tagInput, setTagInput] = useState("");
    const [suggestions, setSuggestions] = useState<string[]>([]);

    useEffect(() => {
        getUserTags()
            .then(setSuggestions)
            .catch(() => setSuggestions([]));
    }, []);

    const addTag = (raw: string) => {
        const t = normalize(raw);
        if (t.length === 0 || tags.includes(t)) {
            setTagInput("");
            return;
        }
        onChange([...tags, t]);
        setTagInput("");
    };

    const removeTag = (t: string) => onChange(tags.filter((x) => x !== t));

    useImperativeHandle(ref, () => ({
        flush: () => {
            const pending = normalize(tagInput);
            const effective = pending.length > 0 && !tags.includes(pending) ? [...tags, pending] : tags;
            if (effective !== tags) {
                onChange(effective);
                setTagInput("");
            }
            return effective;
        },
    }), [tagInput, tags, onChange]);

    const filteredSuggestions = suggestions
        .filter((s) => s.includes(normalize(tagInput)) && !tags.includes(s))
        .slice(0, 5);

    return (
        <View style={{ gap: 12 }}>
            <ThemedText type="caption">Tags</ThemedText>
            {tags.length > 0 && (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {tags.map((t) => (
                        <TouchableOpacity key={t} onPress={() => removeTag(t)} accessibilityLabel={`Remove ${t}`}>
                            <TagChip tag={`${t}  ×`} />
                        </TouchableOpacity>
                    ))}
                </View>
            )}
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                    <ThemedInput
                        useBottomSheetInput={useBottomSheetInput}
                        placeHolder="Add a tag"
                        onSubmit={() => addTag(tagInput)}
                        value={tagInput}
                        setValue={setTagInput}
                    />
                </View>
                <PrimaryButton
                    title="Add"
                    secondary
                    disabled={normalize(tagInput).length === 0}
                    onPress={() => addTag(tagInput)}
                    style={{ width: 88 }}
                />
            </View>
            {filteredSuggestions.length > 0 && (
                <View style={{ gap: 12 }}>
                    <ThemedText type="caption" style={{ color: ThemedColor.caption }}>
                        Suggestions · tap to add
                    </ThemedText>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                        {filteredSuggestions.map((s) => (
                            <TouchableOpacity key={s} onPress={() => addTag(s)}>
                                <TagChip tag={s} />
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            )}
        </View>
    );
});

export default TagEditor;

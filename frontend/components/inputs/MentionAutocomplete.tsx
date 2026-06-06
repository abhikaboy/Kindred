import React from "react";
import { View, FlatList, TouchableOpacity, LayoutChangeEvent } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useFriendsForMention, MentionCandidate } from "@/hooks/useFriendsForMention";
import CachedImage from "@/components/CachedImage";

type Props = {
    query: string | null;
    onPick: (candidate: MentionCandidate) => void;
    // Vertical anchor relative to the input. Exactly one is set by the host.
    top?: number;
    bottom?: number;
    onMeasureHeight?: (height: number) => void;
    maxRows?: number;
};

const ROW_HEIGHT = 48;
const AVATAR_SIZE = 32;

const MentionAutocomplete = ({ query, onPick, top, bottom, onMeasureHeight, maxRows = 5 }: Props) => {
    const ThemedColor = useThemeColor();
    const { filter, loading } = useFriendsForMention();

    if (query === null || loading) return null;

    const matches = filter(query);
    if (matches.length === 0) return null;

    return (
        <View
            onLayout={(e: LayoutChangeEvent) => onMeasureHeight?.(e.nativeEvent.layout.height)}
            style={{
                position: "absolute",
                left: 0,
                right: 0,
                top,
                bottom,
                zIndex: 1000,
                backgroundColor: ThemedColor.background,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: ThemedColor.lightened,
                maxHeight: ROW_HEIGHT * maxRows,
                overflow: "hidden",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.08,
                shadowRadius: 12,
                elevation: 8,
            }}>
            <FlatList
                data={matches}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="always"
                renderItem={({ item }) => (
                    <MentionRow
                        item={item}
                        query={query}
                        onPick={onPick}
                        primary={ThemedColor.primary}
                        caption={ThemedColor.caption}
                        placeholder={ThemedColor.lightened}
                    />
                )}
            />
        </View>
    );
};

type RowProps = {
    item: MentionCandidate;
    query: string;
    onPick: (c: MentionCandidate) => void;
    primary: string;
    caption: string;
    placeholder: string;
};

function MentionRow({ item, query, onPick, primary, caption, placeholder }: RowProps) {
    const q = query.toLowerCase();
    const nameLower = item.display_name.toLowerCase();
    const nameMatchIdx = q ? nameLower.indexOf(q) : -1;
    // Handle already includes the leading "@"; match the query against it without it.
    const handleBody = item.handle.replace(/^@/, "");
    const handleMatchLen = q && handleBody.toLowerCase().startsWith(q) ? q.length : 0;

    return (
        <TouchableOpacity
            onPress={() => onPick(item)}
            activeOpacity={0.6}
            style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingHorizontal: 12,
                height: ROW_HEIGHT,
            }}>
            {item.profile_picture ? (
                <CachedImage
                    source={{ uri: item.profile_picture }}
                    variant="thumbnail"
                    cachePolicy="memory-disk"
                    style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 }}
                />
            ) : (
                <View
                    style={{
                        width: AVATAR_SIZE,
                        height: AVATAR_SIZE,
                        borderRadius: AVATAR_SIZE / 2,
                        backgroundColor: placeholder,
                    }}
                />
            )}
            <View style={{ flex: 1, gap: 1 }}>
                <ThemedText type="default" numberOfLines={1}>
                    {nameMatchIdx >= 0 ? (
                        <>
                            {item.display_name.slice(0, nameMatchIdx)}
                            <ThemedText type="defaultSemiBold" style={{ color: primary }}>
                                {item.display_name.slice(nameMatchIdx, nameMatchIdx + q.length)}
                            </ThemedText>
                            {item.display_name.slice(nameMatchIdx + q.length)}
                        </>
                    ) : (
                        item.display_name
                    )}
                </ThemedText>
                <ThemedText type="caption" numberOfLines={1} style={{ color: caption }}>
                    @
                    {handleMatchLen > 0 ? (
                        <>
                            <ThemedText type="defaultSemiBold" style={{ color: primary, fontSize: 14 }}>
                                {handleBody.slice(0, handleMatchLen)}
                            </ThemedText>
                            {handleBody.slice(handleMatchLen)}
                        </>
                    ) : (
                        handleBody
                    )}
                </ThemedText>
            </View>
        </TouchableOpacity>
    );
}

export default MentionAutocomplete;

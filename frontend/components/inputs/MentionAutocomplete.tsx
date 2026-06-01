import React from "react";
import { View, FlatList, TouchableOpacity } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useFriendsForMention, MentionCandidate } from "@/hooks/useFriendsForMention";

type Props = {
    query: string | null;
    onPick: (candidate: MentionCandidate) => void;
    maxRows?: number;
};

const ROW_HEIGHT = 44;

const MentionAutocomplete = ({ query, onPick, maxRows = 5 }: Props) => {
    const ThemedColor = useThemeColor();
    const { filter, loading } = useFriendsForMention();

    if (query === null || loading) return null;

    const matches = filter(query);
    if (matches.length === 0) return null;

    return (
        <View
            style={{
                backgroundColor: ThemedColor.background,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: ThemedColor.lightened,
                marginTop: 4,
                maxHeight: ROW_HEIGHT * maxRows,
                overflow: "hidden",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.08,
                shadowRadius: 12,
                elevation: 4,
            }}>
            <FlatList
                data={matches}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="always"
                renderItem={({ item }) => (
                    <MentionRow item={item} query={query} onPick={onPick} primary={ThemedColor.primary} />
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
};

function MentionRow({ item, query, onPick, primary }: RowProps) {
    const q = query.toLowerCase();
    const handleLower = item.handle.toLowerCase();
    const nameLower = item.display_name.toLowerCase();
    const handleMatch = q && handleLower.startsWith(q) ? item.handle.slice(0, q.length) : null;
    const nameMatchIdx = q ? nameLower.indexOf(q) : -1;

    return (
        <TouchableOpacity
            onPress={() => onPick(item)}
            activeOpacity={0.6}
            style={{
                paddingHorizontal: 16,
                height: ROW_HEIGHT,
                justifyContent: "center",
            }}>
            <ThemedText type="default">
                {nameMatchIdx >= 0 ? (
                    <>
                        <ThemedText type="default">{item.display_name.slice(0, nameMatchIdx)}</ThemedText>
                        <ThemedText type="defaultSemiBold" style={{ color: primary }}>
                            {item.display_name.slice(nameMatchIdx, nameMatchIdx + q.length)}
                        </ThemedText>
                        <ThemedText type="default">{item.display_name.slice(nameMatchIdx + q.length)}</ThemedText>
                    </>
                ) : (
                    <ThemedText type="default">{item.display_name}</ThemedText>
                )}
                {"  "}
                <ThemedText type="caption">
                    @
                    {handleMatch ? (
                        <>
                            <ThemedText type="defaultSemiBold" style={{ color: primary }}>
                                {handleMatch}
                            </ThemedText>
                            <ThemedText type="caption">{item.handle.slice(q.length)}</ThemedText>
                        </>
                    ) : (
                        item.handle
                    )}
                </ThemedText>
            </ThemedText>
        </TouchableOpacity>
    );
}

export default MentionAutocomplete;

import React from "react";
import { View, FlatList, TouchableOpacity, Image } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useFriendsForMention, MentionCandidate } from "@/hooks/useFriendsForMention";

type Props = {
    query: string | null; // null = hidden
    onPick: (candidate: MentionCandidate) => void;
    maxRows?: number;
};

const ROW_HEIGHT = 56;

const MentionAutocomplete = ({ query, onPick, maxRows = 5 }: Props) => {
    const ThemedColor = useThemeColor();
    const { filter, loading } = useFriendsForMention();

    if (query === null) return null;
    if (loading) return null;

    const matches = filter(query);
    if (matches.length === 0) return null;

    return (
        <View
            style={{
                backgroundColor: ThemedColor.lightened,
                borderRadius: 12,
                maxHeight: ROW_HEIGHT * maxRows,
                marginHorizontal: 16,
                marginBottom: 8,
                overflow: "hidden",
            }}>
            <FlatList
                data={matches}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="always"
                renderItem={({ item }) => (
                    <TouchableOpacity
                        onPress={() => onPick(item)}
                        activeOpacity={0.7}
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingHorizontal: 16,
                            height: ROW_HEIGHT,
                            gap: 12,
                        }}>
                        {item.profile_picture ? (
                            <Image
                                source={{ uri: item.profile_picture }}
                                style={{ width: 36, height: 36, borderRadius: 18 }}
                            />
                        ) : (
                            <View
                                style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 18,
                                    backgroundColor: ThemedColor.background,
                                }}
                            />
                        )}
                        <View style={{ flex: 1 }}>
                            <ThemedText type="defaultSemiBold">{item.display_name}</ThemedText>
                            <ThemedText type="caption">@{item.handle}</ThemedText>
                        </View>
                    </TouchableOpacity>
                )}
            />
        </View>
    );
};

export default MentionAutocomplete;

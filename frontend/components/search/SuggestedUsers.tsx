import React, { useCallback } from "react";
import { View, StyleSheet, FlatList, Pressable } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import ContactCard from "@/components/cards/ContactCard";
import { useThemeColor } from "@/hooks/useThemeColor";
import type { UserExtendedReference } from "@/api/profile";

type SuggestedUsersProps = {
    users: UserExtendedReference[];
    onSeeMore?: () => void;
};

const SuggestedUsersComponent: React.FC<SuggestedUsersProps> = ({ users, onSeeMore }) => {
    const ThemedColor = useThemeColor();
    const renderUser = useCallback(
        ({ item }: { item: UserExtendedReference }) => (
            <ContactCard
                name={item.display_name}
                icon={item.profile_picture}
                handle={item.handle}
                following={false} // We can enhance this later to check actual friendship status
                id={item._id}
                width={100}
            />
        ),
        []
    );

    if (!users || users.length === 0) {
        return null;
    }

    return (
        <View style={styles.suggestedUsersSection}>
            <View style={styles.suggestedUsersHeader}>
                <ThemedText type="defaultSemiBold">Suggested Users</ThemedText>
                {onSeeMore && (
                    <Pressable onPress={onSeeMore} hitSlop={8}>
                        <ThemedText type="caption" style={{ color: ThemedColor.primary }}>
                            See more
                        </ThemedText>
                    </Pressable>
                )}
            </View>
            <FlatList
                data={users}
                renderItem={renderUser}
                keyExtractor={(item) => item._id}
                horizontal={true}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.usersList}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    suggestedUsersSection: {
        marginBottom: 12,
    },
    suggestedUsersHeader: {
        marginBottom: 12,
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    usersList: {
        paddingHorizontal: 16,
        paddingBottom: 3,
        gap: 10,
    },
});

// Memoize SuggestedUsers to prevent unnecessary re-renders
export const SuggestedUsers = React.memo(SuggestedUsersComponent, (prevProps, nextProps) => {
    return prevProps.users === nextProps.users;
});

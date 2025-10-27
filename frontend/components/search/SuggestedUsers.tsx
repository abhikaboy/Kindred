import React, { useCallback } from "react";
import { View, StyleSheet, FlatList } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import ContactCard from "@/components/cards/ContactCard";
import type { UserExtendedReference } from "@/api/profile";

type SuggestedUsersProps = {
    users: UserExtendedReference[];
};

export const SuggestedUsers: React.FC<SuggestedUsersProps> = ({ users }) => {
    const renderUser = useCallback(({ item }: { item: UserExtendedReference }) => (
        <ContactCard
            name={item.display_name}
            icon={item.profile_picture}
            handle={item.handle}
            following={false} // We can enhance this later to check actual friendship status
            id={item._id}
        />
    ), []);

    if (!users || users.length === 0) {
        return null;
    }

    return (
        <View style={styles.suggestedUsersSection}>
            <ThemedText type="subtitle" style={styles.suggestedUsersHeader}>
                Suggested Users
            </ThemedText>
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
        marginBottom: 16,
    },
    suggestedUsersHeader: {
        marginBottom: 16,
        paddingHorizontal: 16,
    },
    usersList: {
        gap: 16,
        paddingHorizontal: 16,
    },
});


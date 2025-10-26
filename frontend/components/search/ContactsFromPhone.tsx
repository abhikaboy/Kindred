import React, { useCallback } from "react";
import { View, StyleSheet, FlatList } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import ContactCard from "@/components/cards/ContactCard";
import type { UserExtendedReferenceWithPhone } from "@/api/profile";

export interface MatchedContact {
    user: UserExtendedReferenceWithPhone;
    contactName: string; // The name from device contacts
}

type ContactsFromPhoneProps = {
    contacts: MatchedContact[];
};

export const ContactsFromPhone: React.FC<ContactsFromPhoneProps> = ({ contacts }) => {
    const renderContact = useCallback(({ item }: { item: MatchedContact }) => (
        <ContactCard
            name={item.user.display_name}
            icon={item.user.profile_picture}
            handle={item.user.handle}
            following={false} // We can enhance this later to check actual friendship status
            id={item.user._id}
            contactName={item.contactName}
        />
    ), []);

    if (!contacts || contacts.length === 0) {
        return null;
    }

    return (
        <View style={styles.contactsSection}>
            <ThemedText type="subtitle" style={styles.contactsHeader}>
                From your Contacts
            </ThemedText>
            <FlatList
                data={contacts}
                renderItem={renderContact}
                keyExtractor={(item) => item.user._id}
                horizontal={true}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.contactsList}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    contactsSection: {
        marginBottom: 16,
    },
    contactsHeader: {
        marginBottom: 16,
        paddingHorizontal: 16,
    },
    contactsList: {
        gap: 16,
        paddingHorizontal: 16,
    },
});


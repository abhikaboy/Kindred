import React, { useCallback } from "react";
import { View, StyleSheet, FlatList } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import ContactCard from "@/components/cards/ContactCard";
import type { UserExtendedReferenceWithPhone } from "@/api/profile";

export interface MatchedContact {
    user: UserExtendedReferenceWithPhone;
    contactName: string; // The name from device contacts
}

type ContactsFromPhoneProps = {
    contacts: MatchedContact[];
    hasSynced?: boolean;
};

const GHOSTS = [0, 1, 2];

/** A faded row of placeholder cards, showing what syncing contacts unlocks. */
export const ContactsPreview: React.FC = () => {
    const ThemedColor = useThemeColor();
    return (
        <View style={styles.ghostRow} pointerEvents="none">
            {GHOSTS.map((i) => (
                <View key={i} style={[styles.ghost, { backgroundColor: ThemedColor.tertiary, opacity: 0.5 - i * 0.12 }]} />
            ))}
        </View>
    );
};

const ContactsFromPhoneComponent: React.FC<ContactsFromPhoneProps> = ({ contacts, hasSynced = true }) => {
    const renderContact = useCallback(
        ({ item }: { item: MatchedContact }) => (
            <ContactCard
                name={item.user.display_name}
                icon={item.user.profile_picture}
                handle={item.user.handle}
                following={false}
                id={item.user._id}
                contactName={item.contactName}
            />
        ),
        []
    );

    // Nothing to show until a sync finds someone (the empty state previews it via ContactsPreview)
    if (!hasSynced || !contacts || contacts.length === 0) return null;

    return (
        <View style={styles.contactsSection}>
            <ThemedText type="defaultSemiBold" style={styles.contactsHeader}>
                From your contacts
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
        marginBottom: 12,
        paddingHorizontal: 16,
    },
    contactsList: {
        paddingHorizontal: 16,
        paddingBottom: 8,
    },
    ghostRow: { flexDirection: "row", gap: 12, marginTop: 12 },
    ghost: { width: 100, height: 128, borderRadius: 16 },
});

export const ContactsFromPhone = React.memo(ContactsFromPhoneComponent);

import { StyleSheet, View, Image, Pressable, useColorScheme, TouchableOpacity } from "react-native";
import React, { useState } from "react";
import { ThemedText } from "../ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import Ionicons from "@expo/vector-icons/Ionicons";

type Props = {
    onDismiss?: () => void;
    onSyncContacts?: () => void;
    isLoadingContacts?: boolean;
    isFindingFriends?: boolean;
    onCardPress?: () => void;
};

const BetterTogetherCard = ({ onDismiss, onSyncContacts, isLoadingContacts, isFindingFriends, onCardPress }: Props) => {
    const ThemedColor = useThemeColor();
    const colorScheme = useColorScheme();
    const [dismissed, setDismissed] = useState(false);

    const handleDismiss = () => {
        setDismissed(true);
        onDismiss?.();
    };

    if (dismissed) {
        return null;
    }

    return (
        <View style={[styles.container, { 
            backgroundColor: ThemedColor.lightened,
            shadowColor: colorScheme === 'dark' ? '#ffffff' : '#000000',
            borderWidth: 1, 
            borderColor: ThemedColor.tertiary,
        }]}>
            <Pressable style={styles.content} onPress={onCardPress}>
                <Image
                    source={require('@/assets/images/together.png')}
                    style={[
                        styles.image,
                        colorScheme === 'dark' && styles.imageInverted
                    ]}
                    resizeMode="contain"
                />
                
                <View style={styles.textRow}>
                    <ThemedText style={[styles.title, { color: ThemedColor.primary }]}>
                        Kindred is Better Together
                    </ThemedText>
                    <ThemedText style={[styles.arrow, { color: ThemedColor.primary }]}>
                        →
                    </ThemedText>
                </View>
                
                <ThemedText style={styles.description}>
                    Here you can search for your friends, link your contact to see whose on Kindred, or Invite your friends to Kindred to earn Rewards!
                </ThemedText>
            </Pressable>
            
            <TouchableOpacity
                style={[styles.syncButton, {
                    backgroundColor: ThemedColor.lightened + "40",
                    borderColor: ThemedColor.primary + "40",
                }]}
                onPress={onSyncContacts}
                disabled={isLoadingContacts || isFindingFriends}
                activeOpacity={0.7}
            >
                <Ionicons 
                    name="person-add-outline" 
                    size={20} 
                    color={ThemedColor.primary} 
                    style={styles.syncButtonIcon}
                />
                <ThemedText style={[styles.syncButtonText, { color: ThemedColor.primary }]}>
                    {isLoadingContacts ? "Loading Contacts..." : isFindingFriends ? "Finding Friends..." : "Sync Contacts"}
                </ThemedText>
            </TouchableOpacity>
            
            <Pressable onPress={handleDismiss}>
                <ThemedText type="caption" style={styles.dismissText}>
                    Don't show this again
                </ThemedText>
            </Pressable>
        </View>
    );
};

export default BetterTogetherCard;

const styles = StyleSheet.create({
    container: {
        borderRadius: 12,
        paddingHorizontal: 24,
        paddingVertical: 12,
        gap: 8,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    content: {
        gap: 4,
    },
    image: {
        width: 180,
        height: 152,
        alignSelf: 'flex-start',
    },
    imageInverted: {
        tintColor: '#ffffff',
    },
    textRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
    },
    title: {
        fontSize: 16,
        fontFamily: 'Outfit',
        fontWeight: '400',
        flex: 1,
    },
    arrow: {
        fontSize: 14,
        fontFamily: 'Outfit',
        fontWeight: '400',
        marginLeft: 8,
    },
    description: {
        fontSize: 16,
        fontFamily: 'Outfit',
        fontWeight: '400',
        lineHeight: 22,
    },
    dismissText: {
        fontSize: 14,
        fontFamily: 'Outfit',
        fontWeight: '400',
    },
    syncButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    syncButtonIcon: {
        marginRight: 8,
    },
    syncButtonText: {
        fontSize: 15,
        fontWeight: "600",
        fontFamily: "Outfit",
    },
});


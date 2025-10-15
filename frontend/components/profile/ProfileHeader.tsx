import React from "react";
import { View, StyleSheet, Dimensions, TouchableOpacity } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import Entypo from "@expo/vector-icons/Entypo";
import * as SMS from 'expo-sms';

interface ProfileHeaderProps {
    displayName: string;
    handle: string;
    userId?: string;
}

export default function ProfileHeader({ displayName, handle, userId }: ProfileHeaderProps) {
    const ThemedColor = useThemeColor();

    const handleShare = async () => {
        if (!userId) return;
        
        try {
            await SMS.sendSMSAsync(
                [], 
                `Add me on Kindred! kindred://account/${userId}`
            );
        } catch (error) {
            console.error("Error sharing profile:", error);
        }
    };

    return (
        <View style={[styles.container, { top: Dimensions.get("window").height * 0.4 }]}>
            <View style={styles.nameContainer}>
                <ThemedText type="hero" style={styles.displayName}>
                    {displayName}
                </ThemedText>
                <ThemedText style={[styles.handle, { color: ThemedColor.caption }]}>{handle}</ThemedText>
            </View>
            {userId && (
                <TouchableOpacity onPress={handleShare} style={styles.shareButton}>
                    <Entypo name="share" size={24} color={ThemedColor.caption} />
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        width: "100%",
    },
    nameContainer: {
        flexDirection: "row",
        flexWrap: "wrap",
        flex: 1,
        alignItems: "flex-end",
        gap: 8,
    },
    displayName: {
        fontWeight: "700",
        zIndex: 3,
        verticalAlign: "top",
    },
    handle: {
        zIndex: 3,
        alignSelf: "flex-end",
        paddingBottom: 8,
    },
    shareButton: {
        zIndex: 3,
        padding: 8,
        paddingBottom: 8,
    },
});

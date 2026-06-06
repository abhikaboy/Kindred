import React from "react";
import { View, StyleSheet, Dimensions, TouchableOpacity } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import Entypo from "@expo/vector-icons/Entypo";
import { Camera } from "phosphor-react-native";
import * as SMS from 'expo-sms';
import { APP_STORE_URL } from "@/constants/appLinks";

interface ProfileHeaderProps {
    displayName: string;
    handle: string;
    userId?: string;
    showCameraBadge?: boolean;
}

export default function ProfileHeader({ displayName, handle, userId, showCameraBadge }: ProfileHeaderProps) {
    const ThemedColor = useThemeColor();

    const handleShare = async () => {
        if (!userId) return;

        try {
            await SMS.sendSMSAsync(
                [],
                `Add me on Kindred! Get the app: ${APP_STORE_URL}`
            );
        } catch (error) {
            console.error("Error sharing profile:", error);
        }
    };

    return (
        <View style={[styles.container, { top: Dimensions.get("window").height * 0.4 }]}>
            {showCameraBadge && (
                <View style={styles.cameraBadge}>
                    <Camera size={12} color="white" weight="fill" />
                </View>
            )}
            <View style={styles.nameContainer}>
                <ThemedText
                    type="hero"
                    style={styles.displayName}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.6}>
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
    cameraBadge: {
        position: "absolute",
        top: -10,
        right: 20,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: "#854dff",
        borderWidth: 2,
        borderColor: "white",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 4,
    },
});

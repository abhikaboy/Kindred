import React, { useState, useMemo } from "react";
import { View, StyleSheet, TouchableOpacity, Alert, Platform } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Sparkle } from "phosphor-react-native";
import { useAuth } from "@/hooks/useAuth";
import EncourageModal from "@/components/modals/EncourageModal";
import * as Haptics from "expo-haptics";

interface ProfileEncouragementCardProps {
    userId: string;
    userHandle?: string;
    userName?: string;
}

export default function ProfileEncouragementCard({ 
    userId, 
    userHandle, 
    userName 
}: ProfileEncouragementCardProps) {
    const ThemedColor = useThemeColor();
    const { user } = useAuth();
    const [showEncourageModal, setShowEncourageModal] = useState(false);

    const styles = useMemo(() => createStyles(ThemedColor), [ThemedColor]);

    // Don't show the card if viewing own profile
    const isOwnProfile = user?._id === userId;
    if (isOwnProfile) {
        return null;
    }

    const handlePress = async () => {
        if (!userId || userId.trim() === "") {
            console.error("Cannot show encourage modal: missing userId");
            Alert.alert("Error", "Unable to send encouragement at this time. Please try again later.");
            return;
        }

        try {
            if (Platform.OS === "ios") {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
        } catch (error) {
            // Ignore haptics errors
        }

        console.log("Profile encourage button pressed, showing modal");
        setShowEncourageModal(true);
    };

    return (
        <>
            <TouchableOpacity 
                style={styles.card} 
                onPress={handlePress}
                activeOpacity={0.7}
            >
                <View style={styles.iconContainer}>
                    <Sparkle 
                        size={24} 
                        color={ThemedColor.primary} 
                        weight="fill"
                    />
                </View>
                <ThemedText type="defaultSemiBold" style={styles.text}>
                    Send Encouragement
                </ThemedText>
            </TouchableOpacity>

            {/* Encourage Modal - Note: task is optional for profile-level encouragements */}
            <EncourageModal
                visible={showEncourageModal}
                setVisible={setShowEncourageModal}
                task={undefined} // No task for profile-level encouragements
                encouragementConfig={{
                    userHandle: userHandle || userName || "User",
                    receiverId: userId,
                    categoryName: "", // Not needed for profile scope
                }}
                isProfileLevel={true} // New prop to indicate profile-level
            />
        </>
    );
}

const createStyles = (ThemedColor: ReturnType<typeof useThemeColor>) =>
    StyleSheet.create({
        card: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: ThemedColor.lightenedCard,
            borderRadius: 12,
            padding: 16,
            shadowRadius: 4,
            elevation: 3,
        },
        iconContainer: {
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: ThemedColor.primary + "10", // 15% opacity
            justifyContent: "center",
            alignItems: "center",
            marginRight: 12,
        },
        text: {
            color: ThemedColor.text,
            fontSize: 16,
        },
    });


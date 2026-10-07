import React, { useState, useMemo } from "react";
import { View, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Sparkle } from "phosphor-react-native";
import { useAuth } from "@/hooks/useAuth";
import EncourageModal from "@/components/modals/EncourageModal";
import * as Haptics from "expo-haptics";
import CustomAlert, { AlertButton } from "@/components/modals/CustomAlert";

interface ProfileEncouragementCardProps {
    userId: string;
    userHandle?: string;
    userName?: string;
}

export default function ProfileEncouragementCard({ userId, userHandle, userName }: ProfileEncouragementCardProps) {
    const ThemedColor = useThemeColor();
    const { user } = useAuth();
    const [showEncourageModal, setShowEncourageModal] = useState(false);

    // Alert state
    const [alertVisible, setAlertVisible] = useState(false);
    const [alertTitle, setAlertTitle] = useState("");
    const [alertMessage, setAlertMessage] = useState("");
    const [alertButtons, setAlertButtons] = useState<AlertButton[]>([]);

    const styles = useMemo(() => createStyles(ThemedColor), [ThemedColor]);

    // Don't show the card if viewing own profile
    const isOwnProfile = user?._id === userId;
    if (isOwnProfile) {
        return null;
    }

    const handlePress = async () => {
        if (!userId || userId.trim() === "") {
            console.error("Cannot show encourage modal: missing userId");
            setAlertTitle("Error");
            setAlertMessage("Unable to send encouragement at this time. Please try again later.");
            setAlertButtons([{ text: "OK", style: "default" }]);
            setAlertVisible(true);
            return;
        }

        try {
            if (Platform.OS === "ios") {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
        } catch (error) {
            // Ignore haptics errors
        }

        setShowEncourageModal(true);
    };

    return (
        <>
            <TouchableOpacity style={styles.card} onPress={handlePress} activeOpacity={0.85}>
                <Sparkle size={20} color={ThemedColor.buttonText} weight="fill" style={styles.icon} />
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

            <CustomAlert
                visible={alertVisible}
                setVisible={setAlertVisible}
                title={alertTitle}
                message={alertMessage}
                buttons={alertButtons}
            />
        </>
    );
}

const createStyles = (ThemedColor: ReturnType<typeof useThemeColor>) =>
    StyleSheet.create({
        card: {
            width: "100%",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: ThemedColor.primary,
            borderRadius: 12,
            paddingVertical: 16,
            paddingHorizontal: 16,
        },
        icon: {
            marginRight: 10,
        },
        text: {
            color: ThemedColor.buttonText,
            fontSize: 15,
            fontFamily: "Outfit",
            fontWeight: "500",
        },
    });

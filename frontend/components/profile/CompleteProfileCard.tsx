import React, { useState } from "react";
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useAuth } from "@/hooks/useAuth";
import { useMediaLibrary } from "@/hooks/useMediaLibrary";
import { uploadImageSmart } from "@/api/upload";
import { showToast } from "@/utils/showToast";
import { Camera } from "phosphor-react-native";

const DEFAULT_PICTURE = "https://i.pinimg.com/736x/45/69/cb/4569cb1033f0251fac46f307c3ba495a.jpg";

interface CompleteProfileCardProps {
    onPhotoUpdated?: () => void;
}

export default function CompleteProfileCard({ onPhotoUpdated }: CompleteProfileCardProps) {
    const ThemedColor = useThemeColor();
    const { user, updateUser } = useAuth();
    const { pickImage } = useMediaLibrary();

    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const [photoCompleted, setPhotoCompleted] = useState(false);

    const hasCustomPhoto = user?.profile_picture && user.profile_picture !== DEFAULT_PICTURE;
    const isPhotoDone = hasCustomPhoto || photoCompleted;

    // Card dismisses once the photo step is complete
    if (isPhotoDone) return null;

    const handlePickPhoto = async () => {
        const result = await pickImage();
        if (result && !result.canceled && result.assets?.[0]) {
            setIsUploadingPhoto(true);
            try {
                const uri = result.assets[0].uri;
                const profilePictureUrl = await uploadImageSmart(
                    "profile",
                    user?._id || "",
                    uri,
                    { variant: "medium" }
                );
                const url = typeof profilePictureUrl === "string"
                    ? profilePictureUrl
                    : profilePictureUrl.public_url;
                updateUser({ profile_picture: url });
                setPhotoCompleted(true);
                onPhotoUpdated?.();
                showToast("Profile photo updated!", "success");
            } catch (error) {
                console.error("Photo upload failed:", error);
                showToast("Failed to upload photo. Try again.", "danger");
            } finally {
                setIsUploadingPhoto(false);
            }
        }
    };

    return (
        <TouchableOpacity
            onPress={handlePickPhoto}
            disabled={isUploadingPhoto}
            activeOpacity={0.7}
            style={[styles.container, {
                backgroundColor: ThemedColor.primary + "08",
                borderColor: ThemedColor.primary + "30",
            }]}
        >
            <View style={[styles.iconContainer, { backgroundColor: ThemedColor.primary + "20" }]}>
                {isUploadingPhoto ? (
                    <ActivityIndicator size="small" color={ThemedColor.primary} />
                ) : (
                    <Camera size={20} color={ThemedColor.primary} weight="regular" />
                )}
            </View>
            <View style={styles.textContainer}>
                <ThemedText type="default" style={styles.title}>
                    {isUploadingPhoto ? "Uploading photo..." : "Add a profile photo"}
                </ThemedText>
                {!isUploadingPhoto && (
                    <ThemedText style={[styles.subtitle, { color: ThemedColor.caption }]}>
                        Stand out with a real photo
                    </ThemedText>
                )}
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderRadius: 12,
        borderWidth: 1,
        padding: 14,
        width: "100%",
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
    },
    textContainer: {
        flex: 1,
        gap: 2,
    },
    title: {
        fontSize: 14,
        fontFamily: "Outfit",
        fontWeight: "400",
    },
    subtitle: {
        fontSize: 12,
        fontFamily: "Outfit",
    },
});

import React, { useState } from "react";
import { View, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useAuth } from "@/hooks/useAuth";
import { useMediaLibrary } from "@/hooks/useMediaLibrary";
import { uploadImageSmart } from "@/api/upload";
import { applyReferralCode } from "@/api/referral";
import { showToast } from "@/utils/showToast";
import { Camera, Ticket, CaretRight, Check } from "phosphor-react-native";
import Svg, { Circle } from "react-native-svg";

const DEFAULT_PICTURE = "https://notioly.com/wp-content/uploads/2025/02/506.Adventurous-Cat.png";

interface CompleteProfileCardProps {
    onPhotoUpdated?: () => void;
}

export default function CompleteProfileCard({ onPhotoUpdated }: CompleteProfileCardProps) {
    const ThemedColor = useThemeColor();
    const { user, updateUser } = useAuth();
    const { pickImage } = useMediaLibrary();

    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const [photoCompleted, setPhotoCompleted] = useState(false);

    const [showReferralInput, setShowReferralInput] = useState(false);
    const [referralCode, setReferralCode] = useState("");
    const [isApplyingReferral, setIsApplyingReferral] = useState(false);
    const [referralCompleted, setReferralCompleted] = useState(false);

    // Check if user has a custom photo (not the default cat)
    const hasCustomPhoto = user?.profile_picture && user.profile_picture !== DEFAULT_PICTURE;
    const isPhotoDone = hasCustomPhoto || photoCompleted;
    const isReferralDone = referralCompleted;

    // Don't render if all steps are done
    if (isPhotoDone && isReferralDone) return null;

    const completedCount = (isPhotoDone ? 1 : 0) + (isReferralDone ? 1 : 0);
    const totalCount = 2;
    const remainingCount = totalCount - completedCount;
    const progressPercent = completedCount / totalCount;

    // SVG progress ring values
    const radius = 15;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference * (1 - progressPercent);

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

    const handleApplyReferral = async () => {
        if (referralCode.length !== 8) return;
        setIsApplyingReferral(true);
        try {
            await applyReferralCode(referralCode);
            setReferralCompleted(true);
            setShowReferralInput(false);
            showToast("Referral code applied! 🎉", "success");
        } catch (error: any) {
            showToast(error.message || "Invalid referral code", "danger");
        } finally {
            setIsApplyingReferral(false);
        }
    };

    const handleReferralCodeChange = (text: string) => {
        setReferralCode(text.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8));
    };

    return (
        <View style={[styles.container, {
            backgroundColor: ThemedColor.background,
            borderColor: ThemedColor.tertiary,
        }]}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <ThemedText style={styles.title}>Complete your profile</ThemedText>
                    <ThemedText style={[styles.subtitle, { color: ThemedColor.caption }]}>
                        {remainingCount} {remainingCount === 1 ? "step" : "steps"} remaining
                    </ThemedText>
                </View>
                <View style={styles.progressRing}>
                    <Svg width={36} height={36} viewBox="0 0 36 36">
                        <Circle
                            cx={18} cy={18} r={radius}
                            fill="none" stroke={ThemedColor.tertiary} strokeWidth={3}
                        />
                        <Circle
                            cx={18} cy={18} r={radius}
                            fill="none" stroke={ThemedColor.primary} strokeWidth={3}
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            transform="rotate(-90 18 18)"
                            strokeLinecap="round"
                        />
                    </Svg>
                    <ThemedText style={[styles.progressText, { color: ThemedColor.primary }]}>
                        {Math.round(progressPercent * 100)}%
                    </ThemedText>
                </View>
            </View>

            {/* Steps */}
            <View style={styles.steps}>
                {/* Photo step */}
                {isPhotoDone ? (
                    <View style={[styles.stepRow, styles.stepCompleted, { backgroundColor: '#f0fff4', borderColor: '#c3e6cb' }]}>
                        <View style={[styles.stepIcon, { backgroundColor: '#d4edda' }]}>
                            <Check size={16} color="#27ae60" weight="bold" />
                        </View>
                        <ThemedText style={[styles.stepTitle, { color: '#27ae60' }]}>
                            Profile photo added
                        </ThemedText>
                    </View>
                ) : (
                    <TouchableOpacity
                        style={[styles.stepRow, { backgroundColor: ThemedColor.lightened, borderColor: ThemedColor.tertiary }]}
                        onPress={handlePickPhoto}
                        disabled={isUploadingPhoto}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.stepIcon, { backgroundColor: ThemedColor.primary + '20' }]}>
                            {isUploadingPhoto ? (
                                <ActivityIndicator size="small" color={ThemedColor.primary} />
                            ) : (
                                <Camera size={16} color={ThemedColor.primary} weight="fill" />
                            )}
                        </View>
                        <View style={styles.stepTextContainer}>
                            <ThemedText style={styles.stepTitle}>
                                {isUploadingPhoto ? "Uploading..." : "Add a profile photo"}
                            </ThemedText>
                            {!isUploadingPhoto && (
                                <ThemedText style={[styles.stepSubtitle, { color: ThemedColor.caption }]}>
                                    Replace the default avatar
                                </ThemedText>
                            )}
                        </View>
                        <CaretRight size={16} color={ThemedColor.caption} />
                    </TouchableOpacity>
                )}

                {/* Referral step */}
                {isReferralDone ? (
                    <View style={[styles.stepRow, styles.stepCompleted, { backgroundColor: '#f0fff4', borderColor: '#c3e6cb' }]}>
                        <View style={[styles.stepIcon, { backgroundColor: '#d4edda' }]}>
                            <Check size={16} color="#27ae60" weight="bold" />
                        </View>
                        <ThemedText style={[styles.stepTitle, { color: '#27ae60' }]}>
                            Referral code applied
                        </ThemedText>
                    </View>
                ) : showReferralInput ? (
                    <View style={[styles.stepRow, styles.referralInputRow, { backgroundColor: ThemedColor.lightened, borderColor: ThemedColor.primary }]}>
                        <View style={styles.referralInputContainer}>
                            <TextInput
                                style={[styles.referralInput, { color: ThemedColor.text, backgroundColor: ThemedColor.background }]}
                                value={referralCode}
                                onChangeText={handleReferralCodeChange}
                                placeholder="ABCD1234"
                                placeholderTextColor={ThemedColor.caption}
                                autoCapitalize="characters"
                                autoCorrect={false}
                                maxLength={8}
                                autoFocus
                            />
                            <TouchableOpacity
                                style={[styles.applyButton, {
                                    backgroundColor: referralCode.length === 8 ? ThemedColor.primary : ThemedColor.tertiary,
                                }]}
                                onPress={handleApplyReferral}
                                disabled={referralCode.length !== 8 || isApplyingReferral}
                            >
                                {isApplyingReferral ? (
                                    <ActivityIndicator size="small" color="white" />
                                ) : (
                                    <ThemedText style={styles.applyButtonText}>Apply</ThemedText>
                                )}
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity onPress={() => { setShowReferralInput(false); setReferralCode(""); }}>
                            <ThemedText style={[styles.cancelText, { color: ThemedColor.caption }]}>Cancel</ThemedText>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <TouchableOpacity
                        style={[styles.stepRow, { backgroundColor: ThemedColor.lightened, borderColor: ThemedColor.tertiary }]}
                        onPress={() => setShowReferralInput(true)}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.stepIcon, { backgroundColor: ThemedColor.primary + '20' }]}>
                            <Ticket size={16} color={ThemedColor.primary} weight="fill" />
                        </View>
                        <View style={styles.stepTextContainer}>
                            <ThemedText style={styles.stepTitle}>Enter referral code</ThemedText>
                            <ThemedText style={[styles.stepSubtitle, { color: ThemedColor.caption }]}>
                                Got a code from a friend?
                            </ThemedText>
                        </View>
                        <CaretRight size={16} color={ThemedColor.caption} />
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        borderRadius: 16,
        borderWidth: 0.5,
        padding: 16,
        width: "100%",
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
    },
    title: {
        fontSize: 15,
        fontFamily: "Outfit",
        fontWeight: "600",
    },
    subtitle: {
        fontSize: 12,
        fontFamily: "Outfit",
        marginTop: 2,
    },
    progressRing: {
        width: 36,
        height: 36,
        position: "relative",
        alignItems: "center",
        justifyContent: "center",
    },
    progressText: {
        position: "absolute",
        fontSize: 11,
        fontFamily: "Outfit",
        fontWeight: "600",
    },
    steps: {
        gap: 8,
    },
    stepRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 10,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: 1,
    },
    stepCompleted: {
        borderWidth: 1,
    },
    stepIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
    },
    stepTextContainer: {
        flex: 1,
    },
    stepTitle: {
        fontSize: 13,
        fontFamily: "Outfit",
        fontWeight: "500",
    },
    stepSubtitle: {
        fontSize: 11,
        fontFamily: "Outfit",
    },
    referralInputRow: {
        flexDirection: "column",
        gap: 8,
        borderWidth: 1,
    },
    referralInputContainer: {
        flexDirection: "row",
        gap: 8,
        width: "100%",
    },
    referralInput: {
        flex: 1,
        fontSize: 16,
        fontFamily: "Outfit",
        fontWeight: "600",
        letterSpacing: 2,
        textAlign: "center",
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 12,
    },
    applyButton: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
    },
    applyButtonText: {
        color: "white",
        fontSize: 14,
        fontFamily: "Outfit",
        fontWeight: "600",
    },
    cancelText: {
        fontSize: 13,
        fontFamily: "Outfit",
        textAlign: "center",
    },
});

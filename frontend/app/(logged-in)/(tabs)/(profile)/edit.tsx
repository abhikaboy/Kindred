import { View, Image, TouchableOpacity, Dimensions, Alert } from "react-native";
import React, { useState } from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/hooks/useAuth";
import { useThemeColor } from "@/hooks/useThemeColor";
import Svg, { Path, Rect } from "react-native-svg";
import InputGroup from "@/components/inputs/InputGroup";
import { uploadImageSmart } from "@/api/upload";
import { updateProfile } from "@/api/profile";
import { router } from "expo-router";
import { useMediaLibrary } from "@/hooks/useMediaLibrary";

const Edit = () => {
    const insets = useSafeAreaInsets();
    const { user, updateUser } = useAuth();
    let ThemedColor = useThemeColor();
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Form state
    const [displayName, setDisplayName] = useState(user?.display_name || "");
    const [handle, setHandle] = useState(user?.handle || "");
    const [activityEnabled, setActivityEnabled] = useState(true);
    const [pushNotifications, setPushNotifications] = useState(false);
    const [todaysTasks, setTodaysTasks] = useState(false);

    const { pickImage: pickImageFromLibrary } = useMediaLibrary();

    const pickImage = async () => {
        const result = await pickImageFromLibrary();
        
        if (result && !result.canceled && result.assets && result.assets.length > 0) {
            const imageUri = result.assets[0].uri;
            setSelectedImage(imageUri);
            console.log("Selected image:", imageUri);
        }
    };

    const handleSave = async () => {
        if (!user?._id) {
            Alert.alert("Error", "User ID not found. Please try logging in again.");
            return;
        }

        setIsSaving(true);
        try {
            let profilePictureUrl = user.profile_picture;

            // If there's a new image selected, upload it first
            if (selectedImage && selectedImage !== user.profile_picture) {
                console.log("Uploading new profile picture...");
                profilePictureUrl = await uploadImageSmart("profile", user._id, selectedImage, { variant: "medium" });
                console.log("Profile picture uploaded:", profilePictureUrl);
                console.log("Type of profilePictureUrl:", typeof profilePictureUrl);
            }

            // Prepare update data with snake_case field names as expected by API
            const updateData: any = {};

            if (displayName !== user.display_name) {
                updateData.display_name = displayName;
            }

            if (handle !== user.handle) {
                updateData.handle = handle;
            }

            if (profilePictureUrl !== user.profile_picture) {
                // Ensure profilePictureUrl is a string, not an object
                if (typeof profilePictureUrl === "string") {
                    updateData.profile_picture = profilePictureUrl;
                } else {
                    console.error("profilePictureUrl is not a string:", profilePictureUrl);
                    throw new Error("Invalid profile picture URL format");
                }
            }

            // Debug: Log the update data
            console.log("Update data being sent:", JSON.stringify(updateData, null, 2));

            // Only update if there are changes
            if (Object.keys(updateData).length > 0) {
                console.log("Updating profile with data:", updateData);
                await updateProfile(user._id, updateData);
                console.log("Profile updated successfully");

                // Update the local user state using the auth context
                updateUser({
                    display_name: displayName,
                    handle: handle,
                    profile_picture: profilePictureUrl,
                });

                console.log("Profile saved successfully!");

                Alert.alert("Success", "Profile updated successfully!");
                router.back();
            } else {
                router.back();
            }
        } catch (error) {
            console.error("Save failed:", error);
            console.error("Error details:", error.message);

            // Provide more specific error messages
            let errorMessage = "Failed to save profile. Please try again.";
            if (error.response?.status === 422) {
                errorMessage = "Invalid profile data. Please check your input and try again.";
            } else if (error.response?.status === 401) {
                errorMessage = "Authentication error. Please log in again.";
            } else if (error.response?.status === 404) {
                errorMessage = "Profile not found. Please try again.";
            }

            Alert.alert("Error", errorMessage);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <ThemedView
            style={{
                paddingHorizontal: HORIZONTAL_PADDING,
                paddingTop: insets.top,
                paddingBottom: insets.bottom,
                display: "flex",
                flexDirection: "column",
            }}>
            <View
                style={{
                    display: "flex",
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}>
                <TouchableOpacity onPress={() => router.back()}>
                    <ThemedText type="defaultSemiBold" style={{ fontSize: 28 }}>
                        ←
                    </ThemedText>
                </TouchableOpacity>
                <ThemedText type="defaultSemiBold">Edit Profile</ThemedText>
                <TouchableOpacity onPress={handleSave} disabled={isSaving}>
                    <ThemedText
                        type="defaultSemiBold"
                        style={{
                            opacity: isSaving ? 0.5 : 1,
                            color: isSaving ? ThemedColor.text : ThemedColor.primary,
                        }}>
                        {isSaving ? "Saving..." : "Save"}
                    </ThemedText>
                </TouchableOpacity>
            </View>
            <View
                style={{
                    display: "flex",
                    flexDirection: "row",
                    justifyContent: "center",
                    alignItems: "center",
                    marginTop: 32,
                }}>
                <TouchableOpacity
                    onPress={() => {
                        console.log("viewing the profile picture");
                    }}>
                    <Image
                        source={{ uri: selectedImage || user?.profile_picture }}
                        style={{
                            width: 128,
                            height: 128,
                            borderRadius: 100,
                            borderWidth: 2,
                            borderColor: ThemedColor.text,
                        }}
                    />
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={pickImage}
                    disabled={isSaving}
                    style={{
                        position: "absolute",
                        left: Dimensions.get("window").width / 2,
                        marginTop: 90,
                        backgroundColor: ThemedColor.lightened,
                        borderRadius: 100,
                        borderColor: ThemedColor.text,
                        opacity: isSaving ? 0.5 : 1,
                    }}>
                    <Svg width="52" height="52" viewBox="0 0 52 52" fill="none">
                        <Rect x="0.5" y="0.5" width="51" height="51" rx="25.5" fill={ThemedColor.lightened} />
                        <Rect x="0.5" y="0.5" width="51" height="51" rx="25.5" stroke="white" />
                        <Rect width="32" height="32" transform="translate(10 10)" fill={ThemedColor.lightened} />
                        <Path
                            d="M36 17H32.535L30.8312 14.445C30.74 14.3082 30.6164 14.196 30.4714 14.1184C30.3264 14.0408 30.1645 14.0001 30 14H22C21.8355 14.0001 21.6736 14.0408 21.5286 14.1184C21.3836 14.196 21.26 14.3082 21.1687 14.445L19.4637 17H16C15.2044 17 14.4413 17.3161 13.8787 17.8787C13.3161 18.4413 13 19.2044 13 20V34C13 34.7956 13.3161 35.5587 13.8787 36.1213C14.4413 36.6839 15.2044 37 16 37H36C36.7956 37 37.5587 36.6839 38.1213 36.1213C38.6839 35.5587 39 34.7956 39 34V20C39 19.2044 38.6839 18.4413 38.1213 17.8787C37.5587 17.3161 36.7956 17 36 17ZM37 34C37 34.2652 36.8946 34.5196 36.7071 34.7071C36.5196 34.8946 36.2652 35 36 35H16C15.7348 35 15.4804 34.8946 15.2929 34.7071C15.1054 34.5196 15 34.2652 15 34V20C15 19.7348 15.1054 19.4804 15.2929 19.2929C15.4804 19.1054 15.7348 19 16 19H20C20.1647 19.0001 20.3268 18.9595 20.4721 18.8819C20.6173 18.8043 20.7411 18.692 20.8325 18.555L22.535 16H29.4638L31.1675 18.555C31.2589 18.692 31.3827 18.8043 31.5279 18.8819C31.6732 18.9595 31.8353 19.0001 32 19H36C36.2652 19 36.5196 19.1054 36.7071 19.2929C36.8946 19.4804 37 19.7348 37 20V34ZM31 27C31 27.2652 30.8946 27.5196 30.7071 27.7071C30.5196 27.8946 30.2652 28 30 28H27V31C27 31.2652 26.8946 31.5196 26.7071 31.7071C26.5196 31.8946 26.2652 32 26 32C25.7348 32 25.4804 31.8946 25.2929 31.7071C25.1054 31.5196 25 31.2652 25 31V28H22C21.7348 28 21.4804 27.8946 21.2929 27.7071C21.1054 27.5196 21 27.2652 21 27C21 26.7348 21.1054 26.4804 21.2929 26.2929C21.4804 26.1054 21.7348 26 22 26H25V23C25 22.7348 25.1054 22.4804 25.2929 22.2929C25.4804 22.1054 25.7348 22 26 22C26.2652 22 26.5196 22.1054 26.7071 22.2929C26.8946 22.4804 27 22.7348 27 23V26H30C30.2652 26 30.5196 26.1054 30.7071 26.2929C30.8946 26.4804 31 26.7348 31 27Z"
                            fill={ThemedColor.text}
                        />
                    </Svg>
                </TouchableOpacity>
            </View>
            <ThemedText type="subtitle_subtle" style={{ marginTop: 32 }}>
                NAME
            </ThemedText>
            <View style={{ marginBottom: 16 }}>
                <InputGroup
                    options={[
                        {
                            label: "Display Name",
                            value: displayName,
                            placeholder: "Enter your display name",
                            type: "text",
                            onChange: (value: string) => setDisplayName(value),
                        },
                        {
                            label: "Handle",
                            value: handle,
                            placeholder: "Enter your handle",
                            type: "text",
                            onChange: (value: string) => setHandle(value),
                        },
                    ]}
                />
            </View>
            <ThemedText type="subtitle_subtle" style={{ marginTop: 4 }}>
                PROFILE
            </ThemedText>
            <View style={{ marginBottom: 16 }}>
                <InputGroup
                    options={[
                        {
                            label: "Activity",
                            value: activityEnabled,
                            placeholder: "asdjaosd",
                            type: "toggle",
                            onChange: (value: boolean) => setActivityEnabled(value),
                        },
                        {
                            label: "Push Notifications",
                            value: pushNotifications,
                            placeholder: "asdjaosd",
                            type: "toggle",
                            onChange: (value: boolean) => setPushNotifications(value),
                        },
                        {
                            label: "Today's Tasks",
                            value: todaysTasks,
                            placeholder: "asdjaosd",
                            type: "toggle",
                            onChange: (value: boolean) => setTodaysTasks(value),
                        },
                    ]}
                />
            </View>
        </ThemedView>
    );
};

export default Edit;

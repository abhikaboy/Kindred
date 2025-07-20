import { Dimensions, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import React, { useState, useEffect } from "react";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useAuth } from "@/hooks/useAuth";
import { createConnectionAPI, deleteConnectionAPI } from "@/api/connection";
import { showToast } from "@/utils/showToast";
import { Profile, RelationshipStatus } from "@/api/types";
import * as Haptics from "expo-haptics";

type Props = {
    profile: Profile; // Profile with relationship information
    onRelationshipChange?: (newStatus: RelationshipStatus, requestId?: string) => void; // Callback for relationship changes
};

export default function FollowButton({ profile, onRelationshipChange }: Props) {
    const [isLoading, setIsLoading] = useState(false);
    const { user } = useAuth();
    let ThemedColor = useThemeColor();

    console.log("FollowButton - profile:", profile);
    console.log("FollowButton - user:", user);

    // Don't render if profile is not loaded yet
    if (!profile) {
        console.log("FollowButton - profile is null, not rendering");
        return null;
    }

    // Get relationship status from profile
    const relationship = profile.relationship?.status || "none";
    console.log("FollowButton - relationship:", relationship);
    console.log("FollowButton - profile.relationship:", profile.relationship);
    console.log("FollowButton - final relationship status:", relationship);

    const relationshipMapping = {
        none: {
            text: "Follow",
            color: ThemedColor.primary,
            action: "follow",
        },
        requested: {
            text: "Requested",
            color: ThemedColor.lightened,
            action: "cancel",
        },
        received: {
            text: "Accept",
            color: ThemedColor.primary,
            action: "accept",
        },
        connected: {
            text: "Friends",
            color: ThemedColor.lightened,
            action: "none",
        },
        self: {
            text: "Edit Profile",
            color: ThemedColor.lightened,
            action: "edit",
        },
    };

    const handleFollowPress = async () => {
        if (Platform.OS === "ios") {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        if (!profile.id || !user?._id || isLoading) return;

        setIsLoading(true);

        try {
            const currentMapping = relationshipMapping[relationship];

            switch (currentMapping.action) {
                case "follow":
                    // Create connection request
                    const connectionData = {
                        reciever: profile.id,
                        requester: {
                            _id: user._id,
                            handle: user.handle || user.display_name || "",
                            name: user.display_name || user.name || "",
                            picture: user.profile_picture || null,
                        },
                    };

                    const newConnection = await createConnectionAPI(connectionData);
                    // Pass the request_id from the API response
                    onRelationshipChange?.("requested", newConnection?.id);
                    showToast("Follow request sent!", "success");
                    break;

                case "cancel":
                    // Cancel connection request
                    if (profile.relationship?.request_id) {
                        await deleteConnectionAPI(profile.relationship.request_id);
                        onRelationshipChange?.("none");
                        showToast("Follow request cancelled", "info");
                    } else {
                        console.error("No request_id found for cancellation");
                        showToast("Unable to cancel request", "danger");
                    }
                    break;

                case "accept":
                    // Accept connection request - this would need a new API endpoint
                    showToast("Accept functionality coming soon!", "info");
                    break;

                case "edit":
                    // Navigate to edit profile - this would need navigation logic
                    showToast("Edit profile functionality coming soon!", "info");
                    break;

                default:
                    break;
            }
        } catch (error) {
            console.error("Error handling follow action:", error);
            showToast("Failed to process request. Please try again.", "danger");
        } finally {
            setIsLoading(false);
        }
    };

    // Don't show button for self profile
    if (relationship === "self") {
        console.log("FollowButton - not showing button for self profile");
        return null;
    }

    console.log("FollowButton - rendering button with relationship:", relationship);

    return (
        <TouchableOpacity
            onPress={handleFollowPress}
            activeOpacity={0.6}
            disabled={isLoading}
            style={{
                backgroundColor: relationshipMapping[relationship].color,
                borderRadius: 12,
                paddingVertical: 12,
                paddingHorizontal: 20,
                width: "100%",
                minWidth: Dimensions.get("screen").width * 0.3,
                opacity: isLoading ? 0.6 : 1,
            }}>
            <Text
                style={{
                    color:
                        relationshipMapping[relationship].color === ThemedColor.lightened
                            ? ThemedColor.text
                            : ThemedColor.buttonText,
                    fontFamily: "Outfit",
                    textAlign: "center",
                    fontWeight: 400,
                }}>
                {isLoading ? "Loading..." : relationshipMapping[relationship].text}
            </Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({});

import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import React, { useState, useEffect } from "react";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useAuth } from "@/hooks/useAuth";
import { createConnectionAPI, deleteConnectionAPI } from "@/api/connection";
import { getProfile } from "@/api/profile";
import { showToast } from "@/utils/showToast";
import { Profile, RelationshipStatus } from "@/api/types";

type Props = {
    profile: Profile; // Profile with relationship information
    onRelationshipChange?: (newStatus: RelationshipStatus) => void; // Callback for relationship changes
};

export default function FollowButton({ profile, onRelationshipChange }: Props) {
    const [isLoading, setIsLoading] = useState(false);
    const { user } = useAuth();
    let ThemedColor = useThemeColor();

    // Get relationship status from profile
    const relationship = profile.relationship?.status || "none";

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
                    onRelationshipChange?.("requested");
                    showToast("Follow request sent!", "success");
                    break;

                case "cancel":
                    // Cancel connection request
                    if (profile.relationship?.request_id) {
                        await deleteConnectionAPI(profile.relationship.request_id);
                        onRelationshipChange?.("none");
                        showToast("Follow request cancelled", "info");
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

    // Don't show button for self profile or if no relationship info
    if (relationship === "self" || !profile.relationship) {
        return null;
    }

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

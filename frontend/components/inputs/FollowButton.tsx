import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import React, { useState } from "react";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useRequest } from "@/hooks/useRequest";
type Props = {
    connectionType: "none" | "friends" | "requested";
    followeeid?: string;
    followerid?: string;
};

export default function FollowButton({ connectionType = "none", followeeid, followerid }: Props) {
    const [relationship, setRelationship] = useState<keyof typeof relationshipMapping>(connectionType);
    let ThemedColor = useThemeColor();
    const { request } = useRequest();

    const relationshipMapping = {
        none: {
            next: "requested" as keyof typeof relationshipMapping,
            text: "Follow",
            color: ThemedColor.primary,
        },
        requested: {
            next: "none" as keyof typeof relationshipMapping,
            text: "Requested",
            color: ThemedColor.lightened,
        },
        friends: {
            next: "none" as keyof typeof relationshipMapping,
            text: "Friends",
            color: ThemedColor.lightened,
        },
    };

    return (
        <TouchableOpacity
            onPress={() => {
                setRelationship(relationshipMapping[relationship].next);
            }}
            activeOpacity={0.6}
            style={{
                backgroundColor: relationshipMapping[relationship].color,
                borderRadius: 12,
                paddingVertical: 12,
                paddingHorizontal: 20,
                width: "100%",
                minWidth: Dimensions.get("screen").width * 0.3,
            }}>
            <Text
                style={{
                    color: ThemedColor.buttonText,
                    fontFamily: "Outfit",
                    textAlign: "center",
                    fontWeight: 400,
                }}>
                {relationshipMapping[relationship].text}
            </Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({});

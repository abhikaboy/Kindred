import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import React, { useState } from "react";
import { useThemeColor } from "@/hooks/useThemeColor";
type Props = {
    following: boolean;
};

export default function FollowButton({ following }: Props) {
    const [follow, setFollowing] = useState(following);
    let ThemedColor = useThemeColor();

    return (
        <TouchableOpacity
            onPress={() => {
                setFollowing(!follow);
            }}
            style={{
                backgroundColor: follow ? ThemedColor.tertiary : ThemedColor.primary,
                borderRadius: 100,
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
                {follow ? "Following" : "Follow"}
            </Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({});

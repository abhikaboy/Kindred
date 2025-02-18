import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import React, { useState } from "react";
import { Colors } from "@/constants/Colors";

type Props = {
    following: boolean;
};

export default function FollowButton({ following }: Props) {
    const [follow, setFollowing] = useState(following);
    return (
        <TouchableOpacity
            onPress={() => {
                setFollowing(!follow);
            }}
            style={{
                backgroundColor: follow ? Colors.dark.primaryPressed : Colors.dark.primary,
                borderRadius: 100,
                paddingVertical: 16,
                paddingHorizontal: 20,
                width: Dimensions.get("screen").width * 0.3,
                minWidth: Dimensions.get("screen").width * 0.3,
            }}>
            <Text
                style={{
                    color: Colors.dark.text,
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

import React from "react";
import { View, StyleSheet, Image } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";

// Using a placeholder image URL - replace with actual asset
const MEETING_IMAGE = require("@/assets/images/185-Analysing.png");

export default function GroupInfoBanner() {
    const ThemedColor = useThemeColor();

    return (
        <View
            style={[
                styles.container,
                {
                    backgroundColor: ThemedColor.background,
                    shadowColor: "#000",
                }
            ]}
        >
            <View style={styles.content}>
                <View style={styles.textContainer}>
                    <ThemedText type="lightBody" style={styles.text}>
                        Groups lets you share posts with subsets of your friends list
                    </ThemedText>
                </View>
                <Image 
                    source={MEETING_IMAGE}
                    style={styles.image}
                    resizeMode="contain"
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: "100%",
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    content: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingLeft: 20,
        paddingRight: 12,
        paddingVertical: 16,
        borderRadius: 8,
    },
    textContainer: {
        flex: 1,
        paddingRight: 12,
    },
    text: {
        lineHeight: 22,
    },
    image: {
        width: 131,
        height: 131,
    },
});


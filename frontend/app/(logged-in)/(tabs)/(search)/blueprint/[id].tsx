import React, { useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, Image, Dimensions, TouchableOpacity } from "react-native";
import { useLocalSearchParams, Stack, router } from "expo-router";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Feather from "@expo/vector-icons/Feather";
import { useBlueprints } from "@/contexts/blueprintContext";
import PreviewIcon from "@/components/profile/PreviewIcon";
import ParallaxScrollView from "@/components/ParallaxScrollView";

const blueprintImage = require("@/assets/images/blueprintReplacement.png");

export default function BlueprintDetailScreen() {
    const { id } = useLocalSearchParams();
    const ThemedColor = useThemeColor();
    const styles = stylesheet(ThemedColor);

    const { selectedBlueprint, getIsSubscribed, getIsLoading, getSubscriberCount, handleSubscribe } = useBlueprints();

    if (!selectedBlueprint) {
        return (
            <ThemedView style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                <ThemedText type="subtitle">Navigate back to the home page.</ThemedText>
            </ThemedView>
        );
    }

    const [isSubscribed, setIsSubscribed] = useState(getIsSubscribed(selectedBlueprint.id, selectedBlueprint.subscribers || []));
    const [isLoading, setIsLoading] = useState(getIsLoading(selectedBlueprint.id));
    const currentSubscriberCount = getSubscriberCount(selectedBlueprint.id, selectedBlueprint.subscribersCount);

    const onSubscribePress = async () => {
        setIsLoading(true);
        await handleSubscribe(selectedBlueprint.id, selectedBlueprint.subscribers || []);
        setIsSubscribed(true);
        setIsLoading(false);
    };

    const getImageSource = () => {
        if (selectedBlueprint.banner && selectedBlueprint.banner.trim() !== "") {
            return { uri: selectedBlueprint.banner };
        }
        return blueprintImage;
    };

    return (
        <ParallaxScrollView
            headerBackgroundColor={{ light: ThemedColor.background, dark: ThemedColor.background }}
            headerImage={<Image source={getImageSource()} style={styles.headerImage} />}>
            <View style={styles.informationContainer}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <TouchableOpacity onPress={() => router.push(`/account/${selectedBlueprint.owner?._id}`)}>
                    <View style={{ flexDirection: "row", gap: 14 }}>
                        <PreviewIcon icon={selectedBlueprint.owner?.profile_picture || ""} size={"medium"}></PreviewIcon>

                        <View style={{ flexDirection: "column" }}>
                            <ThemedText type="default">{selectedBlueprint.owner?.display_name || "Unknown"}</ThemedText>
                            <ThemedText type="caption">{selectedBlueprint.owner?.handle || ""}</ThemedText>
                        </View>
                    </View>
                    </TouchableOpacity>

                    <PrimaryButton
                        style={{ height: 38, width: 100, paddingVertical: 10, paddingHorizontal: 10 }}
                        title={isLoading ? "..." : isSubscribed ? "Subscribed" : "Subscribe"}
                        outline={isSubscribed}
                        onPress={onSubscribePress}
                        disabled={isLoading}
                    />
                </View>

                <ThemedText type="subtitle">{selectedBlueprint.name}</ThemedText>
                <ThemedText type="default">{selectedBlueprint.description}</ThemedText>

                <View style={{ flexDirection: "row", gap: 5, alignItems: "center" }}>
                    <MaterialIcons name="access-alarm" size={20} color={ThemedColor.text} />
                    <ThemedText type="smallerDefault">{selectedBlueprint.duration}</ThemedText>
                </View>

                <View style={{ flexDirection: "row", gap: 5, alignItems: "center" }}>
                    <Feather name="users" size={18} color={ThemedColor.caption} />
                    <ThemedText type="caption">{currentSubscriberCount} subscribers</ThemedText>
                </View>

                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                    {selectedBlueprint.tags.map((tag, index) => (
                        <ThemedText
                            key={index}
                            style={[styles.tag, { borderColor: ThemedColor.primaryPressed }]}
                            type="smallerDefault">
                            {tag}
                        </ThemedText>
                    ))}
                </View>
            </View>
        </ParallaxScrollView>
    );
}

const stylesheet = (ThemedColor: any) =>
    StyleSheet.create({
        container: {
            width: "100%",
            flexDirection: "column",
        },
        headerImage: {
            width: "100%",
            height: "100%",
            resizeMode: "cover",
        },
        informationContainer: {
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
            flexDirection: "column",
            paddingHorizontal: 20,
            paddingVertical: 24,
            gap: 13,
            backgroundColor: ThemedColor.background,
            marginTop: -23,
        },
        tag: {
            borderWidth: 1,
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 5,
            marginBottom: 4,
        },
    });

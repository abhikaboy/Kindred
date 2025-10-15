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
import { Category } from "@/components/category";
import Entypo from "@expo/vector-icons/Entypo";
import * as Sharing from 'expo-sharing';
import * as SMS from 'expo-sms';
import { getBlueprintById } from "@/api/blueprint";
import { useTasks } from "@/contexts/tasksContext";
import TaskTabs from "@/components/inputs/TaskTabs";
import ConditionalView from "@/components/ui/ConditionalView";
import BlueprintGallery from "@/components/profile/BlueprintGallery";

const blueprintImage = require("@/assets/images/blueprintReplacement.png");

export default function BlueprintDetailScreen() {
    const { id } = useLocalSearchParams();
    const ThemedColor = useThemeColor();
    const styles = stylesheet(ThemedColor);

    const { selectedBlueprint, getIsSubscribed, getIsLoading, getSubscriberCount, handleSubscribe, setSelectedBlueprint } = useBlueprints();
    const { fetchWorkspaces } = useTasks();
    
    const [activeTab, setActiveTab] = useState(0);
    const [isLoadingBlueprint, setIsLoadingBlueprint] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [currentSubscriberCount, setCurrentSubscriberCount] = useState(0);

    // Fetch blueprint data when ID changes
    useEffect(() => {
        const fetchBlueprint = async () => {
            if (!id) {
                setLoadError("No blueprint ID provided");
                setIsLoadingBlueprint(false);
                return;
            }

            try {
                setIsLoadingBlueprint(true);
                setLoadError(null);
                const blueprint = await getBlueprintById(id as string);
                setSelectedBlueprint(blueprint);
            } catch (error) {
                console.error("Error fetching blueprint:", error);
                setLoadError("Failed to load blueprint");
            } finally {
                setIsLoadingBlueprint(false);
            }
        };
        fetchBlueprint();
    }, [id]);

    // Update local state when selectedBlueprint changes
    useEffect(() => {
        if (selectedBlueprint) {
            setIsSubscribed(getIsSubscribed(selectedBlueprint.id, selectedBlueprint.subscribers || []));
            setIsLoading(getIsLoading(selectedBlueprint.id));
            setCurrentSubscriberCount(getSubscriberCount(selectedBlueprint.id, selectedBlueprint.subscribersCount));
        }
    }, [selectedBlueprint, getIsSubscribed, getIsLoading, getSubscriberCount]);

    // Show loading state
    if (isLoadingBlueprint) {
        return (
            <ThemedView style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                <ThemedText type="subtitle">Loading blueprint...</ThemedText>
            </ThemedView>
        );
    }

    // Show error state
    if (loadError || !selectedBlueprint) {
        return (
            <ThemedView style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                <ThemedText type="subtitle">{loadError || "Blueprint not found"}</ThemedText>
                <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
                    <ThemedText type="default" style={{ color: ThemedColor.primary }}>Go Back</ThemedText>
                </TouchableOpacity>
            </ThemedView>
        );
    }

    const onSubscribePress = async () => {
        setIsLoading(true);
        await handleSubscribe(selectedBlueprint.id, selectedBlueprint.subscribers || []);
        await fetchWorkspaces();
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

                <View style={{ flexDirection: "row", gap: 5, alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ flexDirection: "row", gap: 5, alignItems: "center" }}>

                    <View style={{ flexDirection: "row", gap: 5, alignItems: "center" }}>
                        <MaterialIcons name="access-alarm" size={20} color={ThemedColor.text} />
                        <ThemedText type="smallerDefault">{selectedBlueprint.duration}</ThemedText>
                    </View>
                    <MaterialIcons name="category" size={20} color={ThemedColor.text} />
                    <ThemedText type="smallerDefault">{selectedBlueprint.category}</ThemedText>
                    </View>
                    <TouchableOpacity onPress={() => {
                        SMS.sendSMSAsync([], `kindred://blueprint/${selectedBlueprint.id}`);
                    }}>
                        <Entypo name="share-alternative" size={20} color={ThemedColor.text} />
                    </TouchableOpacity>

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

                <TaskTabs tabs={["Tasks", "Gallery"]} activeTab={activeTab} setActiveTab={setActiveTab} />

                <ConditionalView condition={activeTab === 0}>
                    <View style={{ gap: 12, paddingBottom: 24 }}>
                        {selectedBlueprint?.categories?.length > 0 ? (
                            selectedBlueprint?.categories?.map((category, index) => (
                                <Category key={index} id={category.id} name={category.name} tasks={category.tasks as any} onLongPress={() => {}} onPress={() => {}} viewOnly/>
                            ))
                        ) : (
                            <ThemedText type="default">No categories</ThemedText>
                        )}
                    </View>
                </ConditionalView>

                <ConditionalView condition={activeTab === 1}>
                    <BlueprintGallery blueprintId={selectedBlueprint.id} />
                </ConditionalView>
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

import React, { useEffect, useState, useRef } from "react";
import { View, StyleSheet, ScrollView, Image, Dimensions, TouchableOpacity, Animated } from "react-native";
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
import * as Sharing from "expo-sharing";
import * as SMS from "expo-sms";
import { getBlueprintById } from "@/api/blueprint";
import { useTasks } from "@/contexts/tasksContext";
import TaskTabs from "@/components/inputs/TaskTabs";
import ConditionalView from "@/components/ui/ConditionalView";
import BlueprintGallery from "@/components/profile/BlueprintGallery";

const blueprintImage = require("@/assets/images/blueprintReplacement.png");

// Skeleton Loader Component
const BlueprintDetailSkeleton = ({ ThemedColor }: { ThemedColor: any }) => {
    const shimmerAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(shimmerAnim, {
                    toValue: 1,
                    duration: 1500,
                    useNativeDriver: true,
                }),
                Animated.timing(shimmerAnim, {
                    toValue: 0,
                    duration: 1500,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, [shimmerAnim]);

    const opacity = shimmerAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.7],
    });

    return (
        <ParallaxScrollView
            headerBackgroundColor={{ light: ThemedColor.background, dark: ThemedColor.background }}
            headerImage={
                <Animated.View
                    style={[
                        skeletonStyles.headerImageSkeleton,
                        {
                            backgroundColor: ThemedColor.tertiary,
                            opacity,
                        },
                    ]}
                />
            }>
            <View style={skeletonStyles.informationContainer}>
                {/* Owner info skeleton */}
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
                        <Animated.View
                            style={[
                                skeletonStyles.avatarSkeleton,
                                {
                                    backgroundColor: ThemedColor.tertiary,
                                    opacity,
                                },
                            ]}
                        />
                        <View style={{ gap: 8 }}>
                            <Animated.View
                                style={[
                                    skeletonStyles.nameSkeleton,
                                    {
                                        backgroundColor: ThemedColor.tertiary,
                                        opacity,
                                    },
                                ]}
                            />
                            <Animated.View
                                style={[
                                    skeletonStyles.handleSkeleton,
                                    {
                                        backgroundColor: ThemedColor.tertiary,
                                        opacity,
                                    },
                                ]}
                            />
                        </View>
                    </View>
                    <Animated.View
                        style={[
                            skeletonStyles.buttonSkeleton,
                            {
                                backgroundColor: ThemedColor.tertiary,
                                opacity,
                            },
                        ]}
                    />
                </View>

                {/* Title skeleton */}
                <Animated.View
                    style={[
                        skeletonStyles.titleSkeleton,
                        {
                            backgroundColor: ThemedColor.tertiary,
                            opacity,
                        },
                    ]}
                />

                {/* Description skeleton */}
                <View style={{ gap: 8 }}>
                    <Animated.View
                        style={[
                            skeletonStyles.descriptionLineSkeleton,
                            {
                                backgroundColor: ThemedColor.tertiary,
                                opacity,
                                width: "100%",
                            },
                        ]}
                    />
                    <Animated.View
                        style={[
                            skeletonStyles.descriptionLineSkeleton,
                            {
                                backgroundColor: ThemedColor.tertiary,
                                opacity,
                                width: "85%",
                            },
                        ]}
                    />
                    <Animated.View
                        style={[
                            skeletonStyles.descriptionLineSkeleton,
                            {
                                backgroundColor: ThemedColor.tertiary,
                                opacity,
                                width: "60%",
                            },
                        ]}
                    />
                </View>

                {/* Metadata skeleton */}
                <View style={{ flexDirection: "row", gap: 20 }}>
                    <Animated.View
                        style={[
                            skeletonStyles.metadataSkeleton,
                            {
                                backgroundColor: ThemedColor.tertiary,
                                opacity,
                            },
                        ]}
                    />
                    <Animated.View
                        style={[
                            skeletonStyles.metadataSkeleton,
                            {
                                backgroundColor: ThemedColor.tertiary,
                                opacity,
                            },
                        ]}
                    />
                </View>

                {/* Subscribers skeleton */}
                <Animated.View
                    style={[
                        skeletonStyles.subscribersSkeleton,
                        {
                            backgroundColor: ThemedColor.tertiary,
                            opacity,
                        },
                    ]}
                />

                {/* Tags skeleton */}
                <View style={{ flexDirection: "row", gap: 10 }}>
                    {[1, 2, 3].map((_, index) => (
                        <Animated.View
                            key={index}
                            style={[
                                skeletonStyles.tagSkeleton,
                                {
                                    backgroundColor: ThemedColor.tertiary,
                                    opacity,
                                },
                            ]}
                        />
                    ))}
                </View>

                {/* Tabs skeleton */}
                <Animated.View
                    style={[
                        skeletonStyles.tabsSkeleton,
                        {
                            backgroundColor: ThemedColor.tertiary,
                            opacity,
                        },
                    ]}
                />

                {/* Task items skeleton */}
                <View style={{ gap: 12, paddingBottom: 24 }}>
                    {[1, 2, 3].map((_, index) => (
                        <Animated.View
                            key={index}
                            style={[
                                skeletonStyles.taskItemSkeleton,
                                {
                                    backgroundColor: ThemedColor.tertiary,
                                    opacity,
                                },
                            ]}
                        />
                    ))}
                </View>
            </View>
        </ParallaxScrollView>
    );
};

export default function BlueprintDetailScreen() {
    const { id } = useLocalSearchParams();
    const ThemedColor = useThemeColor();
    const styles = stylesheet(ThemedColor);

    const {
        selectedBlueprint,
        getIsSubscribed,
        getIsLoading,
        getSubscriberCount,
        handleSubscribe,
        setSelectedBlueprint,
    } = useBlueprints();
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

    // Show loading state with skeleton
    if (isLoadingBlueprint) {
        return <BlueprintDetailSkeleton ThemedColor={ThemedColor} />;
    }

    // Show error state
    if (loadError || !selectedBlueprint) {
        return (
            <ThemedView style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                <ThemedText type="subtitle">{loadError || "Blueprint not found"}</ThemedText>
                <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
                    <ThemedText type="default" style={{ color: ThemedColor.primary }}>
                        Go Back
                    </ThemedText>
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
                            <PreviewIcon
                                icon={selectedBlueprint.owner?.profile_picture || ""}
                                size={"medium"}></PreviewIcon>
                            <View style={{ flexDirection: "column" }}>
                                <ThemedText type="default">
                                    {selectedBlueprint.owner?.display_name || "Unknown"}
                                </ThemedText>
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
                    <TouchableOpacity
                        onPress={() => {
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
                                <Category
                                    key={index}
                                    id={category.id}
                                    name={category.name}
                                    tasks={category.tasks as any}
                                    onLongPress={() => {}}
                                    onPress={() => {}}
                                    viewOnly
                                />
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
            marginBottom: 70
        },
        tag: {
            borderWidth: 1,
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 5,
            marginBottom: 4,
        },
    });

// Skeleton Styles
const skeletonStyles = StyleSheet.create({
    informationContainer: {
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        flexDirection: "column",
        paddingHorizontal: 20,
        paddingVertical: 24,
        gap: 13,
        marginTop: -23,
    },
    headerImageSkeleton: {
        width: "100%",
        height: "100%",
    },
    avatarSkeleton: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    nameSkeleton: {
        width: 120,
        height: 16,
        borderRadius: 4,
    },
    handleSkeleton: {
        width: 80,
        height: 12,
        borderRadius: 4,
    },
    buttonSkeleton: {
        width: 100,
        height: 38,
        borderRadius: 8,
    },
    titleSkeleton: {
        width: 200,
        height: 24,
        borderRadius: 4,
    },
    descriptionLineSkeleton: {
        height: 14,
        borderRadius: 4,
    },
    metadataSkeleton: {
        width: 100,
        height: 16,
        borderRadius: 4,
    },
    subscribersSkeleton: {
        width: 120,
        height: 14,
        borderRadius: 4,
    },
    tagSkeleton: {
        width: 60,
        height: 28,
        borderRadius: 8,
    },
    tabsSkeleton: {
        width: "100%",
        height: 40,
        borderRadius: 8,
    },
    taskItemSkeleton: {
        width: "100%",
        height: 80,
        borderRadius: 12,
    },
});

import React, { useState, useEffect } from "react";
import { TouchableOpacity, View, StyleSheet, Image as RNImage, ScrollView } from "react-native";
import { ThemedText } from "../ThemedText";
import { useRouter } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";
import PrimaryButton from "../inputs/PrimaryButton";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Feather from "@expo/vector-icons/Feather";
import { useBlueprints } from "@/contexts/blueprintContext";
import type { components } from "@/api/generated/types";
import CachedImage from "../CachedImage";
import * as Haptics from "expo-haptics";
import { useTasks } from "@/contexts/tasksContext";
import { Clock, Users } from "phosphor-react-native";
import { FlatList } from "react-native";

const blueprintImage = require("@/assets/images/blueprintReplacement.png");

type BlueprintDocument = components["schemas"]["BlueprintDocument"];
const ThemedColor = useThemeColor();
const MAX_VISIBLE_TAGS = 2;
interface Props extends BlueprintDocument {
    large?: boolean;
}

const BlueprintCard = ({
    id,
    banner,
    name,
    duration,
    subscribersCount,
    description,
    tags,
    subscribers = [],
    owner,
    large = false,
    categories,
    category,
}: Props) => {
    const ThemedColor = useThemeColor();
    const styles = stylesheet(ThemedColor, large);
    const router = useRouter();
    const { setSelectedBlueprint, getIsSubscribed, getIsLoading, getSubscriberCount, handleSubscribe } =
        useBlueprints();
    const { fetchWorkspaces } = useTasks();

    // Local state for subscription status and loading
    const [localIsSubscribed, setLocalIsSubscribed] = useState(getIsSubscribed(id, subscribers));
    const [localIsLoading, setLocalIsLoading] = useState(false);
    const [localSubscriberCount, setLocalSubscriberCount] = useState(getSubscriberCount(id, subscribersCount));

    // Update local state when props change (for cases where parent data updates)
    useEffect(() => {
        setLocalIsSubscribed(getIsSubscribed(id, subscribers));
        setLocalSubscriberCount(getSubscriberCount(id, subscribersCount));
    }, [id, subscribers, subscribersCount, getIsSubscribed, getSubscriberCount]);

    const handlePress = () => {
        setSelectedBlueprint({
            id,
            banner,
            name,
            duration,
            subscribersCount: localSubscriberCount,
            description,
            tags,
            subscribers,
            owner,
            timestamp: new Date().toISOString(), // Add required timestamp
            categories,
            category,
        });
        router.push(`/blueprint/${id}`);
    };

    const onSubscribePress = async () => {
        try {
            // Optimistic update - immediately update local state
            setLocalIsLoading(true);
            const wasSubscribed = localIsSubscribed;
            const newSubscribedState = !wasSubscribed;

            setLocalIsSubscribed(newSubscribedState);
            setLocalSubscriberCount((prev) => (newSubscribedState ? prev + 1 : Math.max(0, prev - 1)));

            // Haptic feedback
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

            // Call the actual API
            await handleSubscribe(id, subscribers);
            await fetchWorkspaces();
        } catch (error) {
            // Revert optimistic update on error
            console.error("Error updating subscription:", error);
            setLocalIsSubscribed(getIsSubscribed(id, subscribers));
            setLocalSubscriberCount(getSubscriberCount(id, subscribersCount));
        } finally {
            setLocalIsLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <TouchableOpacity onPress={handlePress}>
                <View style={styles.informationContainer}>
                    <CachedImage
                        source={banner ? { uri: banner } : blueprintImage}
                        style={{
                            width: "100%",
                            height: 135,
                            borderRadius: 11,
                            paddingHorizontal: 8,
                            borderWidth: 0.5,
                            borderColor: ThemedColor.tertiary,
                            shadowColor: ThemedColor.shadowSmall,
                        }}
                        variant="medium"
                        cachePolicy="disk"
                        useLocalPlaceholder={!banner}
                    />
                    <ThemedText type="defaultSemiBold" numberOfLines={1} ellipsizeMode="tail">
                        {name}
                    </ThemedText>

                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 5,
                            marginTop: 1,
                            marginBottom: 1,
                        }}>
                        {tags.slice(0, MAX_VISIBLE_TAGS).map((tag, index) => (
                            <ThemedText
                                key={index}
                                style={[
                                    styles.tag,
                                    {
                                        borderColor: ThemedColor.primaryPressed,
                                    },
                                ]}
                                type="smallerDefault"
                                numberOfLines={1}
                                ellipsizeMode="tail">
                                {tag}
                            </ThemedText>
                        ))}
                        {tags.length > MAX_VISIBLE_TAGS && (
                            <ThemedText
                                style={[
                                    styles.tag,
                                    {
                                        borderColor: ThemedColor.primaryPressed,
                                    },
                                ]}
                                type="smallerDefault">
                                +{tags.length - MAX_VISIBLE_TAGS}
                            </ThemedText>
                        )}
                    </View>

                    <View
                        style={{
                            flexDirection: "row",
                            gap: 5,
                            alignItems: "center",
                            maxWidth: "100%",
                        }}>
                        <Clock size={20} weight="light" color={ThemedColor.text} />
                        <ThemedText type="smallerDefault" numberOfLines={1} ellipsizeMode="tail" style={{ flex: 1 }}>
                            {duration}
                        </ThemedText>
                    </View>

                    <View
                        style={{
                            flexDirection: "row",
                            gap: 5,
                            marginBottom: 2,
                            alignItems: "center",
                            maxWidth: "100%",
                        }}>
                        <Users size={20} weight="light" color={ThemedColor.caption} />
                        <ThemedText type="caption" numberOfLines={1} ellipsizeMode="tail" style={{ flex: 1 }}>
                            {localSubscriberCount} Subscribers
                        </ThemedText>
                    </View>
                </View>
            </TouchableOpacity>
        </View>
    );
};

const stylesheet = (ThemedColor: any, large: boolean) =>
    StyleSheet.create({
        container: {
            width: large ? "100%" : 240,
            flexDirection: "column",
        },
        informationContainer: {
            flexDirection: "column",
            paddingHorizontal: 8,
            paddingVertical: 8,
            gap: 6,
            backgroundColor: ThemedColor.lightenedCard,
            borderRadius: 15,
            borderWidth: 1,
            borderColor: ThemedColor.tertiary,
            boxShadow: ThemedColor.shadowSmall,
        },
        tag: {
            borderWidth: 0.5,
            borderRadius: 15,
            paddingHorizontal: 10,
            paddingVertical: 4,
            marginBottom: 4,
        },
    });

export default BlueprintCard;

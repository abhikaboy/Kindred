import React, { useState, useEffect } from "react";
import { TouchableOpacity, View, StyleSheet, Image as RNImage } from "react-native";
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

const blueprintImage = require("@/assets/images/blueprintReplacement.png");

type BlueprintDocument = components["schemas"]["BlueprintDocument"];

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
    const { setSelectedBlueprint, getIsSubscribed, getIsLoading, getSubscriberCount, handleSubscribe } = useBlueprints();
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
            setLocalSubscriberCount(prev => newSubscribedState ? prev + 1 : Math.max(0, prev - 1));
            
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
                <CachedImage
                    source={banner ? { uri: banner } : blueprintImage}
                    style={{
                        width: "100%",
                        height: 135,
                        borderTopLeftRadius: 11,
                        borderTopRightRadius: 11,
                    }}
                    variant="medium"
                    cachePolicy="disk"
                    useLocalPlaceholder={!banner} // Use local placeholder when no banner
                />
                <View style={styles.informationContainer}>
                    <ThemedText type="subtitle">{name}</ThemedText>

                    <View style={{ flexDirection: "row", gap: 5, alignItems: "center" }}>
                        <MaterialIcons name="access-alarm" size={20} color={ThemedColor.text} />
                        <ThemedText type="smallerDefault">{duration}</ThemedText>
                    </View>

                    <View style={{ flexDirection: "row", gap: 5, alignItems: "center" }}>
                        <Feather name="users" size={18} color={ThemedColor.caption} />
                        <ThemedText type="caption">{localSubscriberCount} Subscribers</ThemedText>
                    </View>

                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 10,
                            overflow: "hidden",
                            width: "100%",
                        }}>
                        {tags.map((tag, index) => (
                            <ThemedText
                                key={index}
                                style={[
                                    styles.tag,
                                    {
                                        borderColor: ThemedColor.primaryPressed,
                                        flexShrink: 0,
                                    },
                                ]}
                                type="smallerDefault">
                                {tag}
                            </ThemedText>
                        ))}
                    </View>

                    <PrimaryButton
                        style={{ width: 100,paddingVertical: 10, paddingHorizontal: 10 }}
                        title={localIsLoading ? "..." : localIsSubscribed ? "Subscribed" : "Subscribe"}
                        onPress={onSubscribePress}
                        outline={localIsSubscribed}
                        disabled={localIsLoading}
                    />
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
            paddingHorizontal: 15,
            paddingVertical: 18,
            gap: 7,
            backgroundColor: ThemedColor.lightened,
            borderBottomLeftRadius: 11,
            borderBottomRightRadius: 11,
            boxShadow: ThemedColor.shadowSmall,
        },
        tag: {
            borderWidth: 1,
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 5,
            marginBottom: 4,
        },
    });

export default BlueprintCard;

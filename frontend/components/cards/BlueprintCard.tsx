import React, { useState } from "react";
import { TouchableOpacity, View, StyleSheet, Image } from "react-native";
import { ThemedText } from "../ThemedText";
import { useRouter } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";
import PrimaryButton from "../inputs/PrimaryButton";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Feather from "@expo/vector-icons/Feather";
import { useBlueprints } from "@/contexts/blueprintContext";

const blueprintImage = require("@/assets/images/blueprintReplacement.png");

interface Props {
    id: string;
    previewImage: string;
    userImage: string;
    workspaceName: string;
    username: string;
    name: string;
    time: string;
    subscriberCount: number;
    description: string;
    tags: string[];
    subscribers?: string[];
    large?: boolean;
}

const BlueprintCard = ({
    id,
    previewImage,
    userImage,
    workspaceName,
    username,
    name,
    time,
    subscriberCount,
    description,
    tags,
    subscribers = [],
    large = false,
}: Props) => {
    const ThemedColor = useThemeColor();
    const styles = stylesheet(ThemedColor, large);
    const router = useRouter();
    const { setSelectedBlueprint, getIsSubscribed, getIsLoading, getSubscriberCount, handleSubscribe } =
        useBlueprints();

    const isSubscribed = getIsSubscribed(id, subscribers);
    const isLoading = getIsLoading(id);
    const currentSubscriberCount = getSubscriberCount(id, subscriberCount);

    const handlePress = () => {
        setSelectedBlueprint({
            id,
            previewImage,
            userImage,
            workspaceName,
            username,
            name,
            time,
            subscriberCount: currentSubscriberCount,
            description,
            tags,
            subscribers,
        });
        router.push({
            pathname: "/(logged-in)/(tabs)/(search)/blueprint/[id]",
            params: {
                id: id,
                name: workspaceName,
            },
        });
    };

    const onSubscribePress = async () => {
        await handleSubscribe(id, subscribers);
    };

    return (
        <View style={styles.container}>
            <TouchableOpacity onPress={handlePress}>
                <Image
                    source={previewImage ? { uri: previewImage } : blueprintImage}
                    style={{
                        width: "100%",
                        height: 135,
                        borderTopLeftRadius: 11,
                        borderTopRightRadius: 11,
                    }}
                />
                <View style={styles.informationContainer}>
                    <ThemedText type="subtitle">{workspaceName}</ThemedText>

                    <View style={{ flexDirection: "row", gap: 5, alignItems: "center" }}>
                        <MaterialIcons name="access-alarm" size={20} color={ThemedColor.text} />
                        <ThemedText type="smallerDefault">{time}</ThemedText>
                    </View>

                    <View style={{ flexDirection: "row", gap: 5, alignItems: "center" }}>
                        <Feather name="users" size={18} color={ThemedColor.caption} />
                        <ThemedText type="caption">{currentSubscriberCount} Subscribers</ThemedText>
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
                        style={{ width: 100, paddingVertical: 10, paddingHorizontal: 10 }}
                        title={isLoading ? "..." : isSubscribed ? "Subscribed" : "Subscribe"}
                        onPress={onSubscribePress}
                        outline={isSubscribed}
                        disabled={isLoading}
                    />
                </View>
            </TouchableOpacity>
        </View>
    );
};

const stylesheet = (ThemedColor: any, large: boolean) =>
    StyleSheet.create({
        container: {
            width: large ? "100%" : 280,
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

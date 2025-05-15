import { Dimensions, StyleSheet, View, ScrollView, TouchableOpacity, Text } from "react-native";
import React, { useEffect } from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import Ionicons from "@expo/vector-icons/Ionicons";
import UserInfoFollowRequest from "@/components/UserInfo/UserInfoFollowRequest";
import { Icons } from "@/constants/Icons";
import { router } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import * as SMS from "expo-sms";
import { HORIZONTAL_PADDING } from "@/constants/spacing";

type FollowRequestProps = {
    name: string;
    username: string;
    icon: string;
    userId: string;
};

const follow_requests: FollowRequestProps[] = [
    {
        name: "Monkey D. Luffy",
        username: "kingofpirates",
        icon: Icons.luffy,
        userId: "user123",
    },
    {
        name: "Coffee Lover",
        username: "coffeecoder",
        icon: Icons.coffee,
        userId: "user456",
    },
    {
        name: "Latte Artist",
        username: "latteart",
        icon: Icons.latte,
        userId: "user789",
    },
    {
        name: "Monkey D. Luffy",
        username: "kingofpirates",
        icon: Icons.luffy,
        userId: "user123",
    },
    {
        name: "Coffee Lover",
        username: "coffeecoder",
        icon: Icons.coffee,
        userId: "user456",
    },
    {
        name: "Latte Artist",
        username: "latteart",
        icon: Icons.latte,
        userId: "user789",
    },
];

const FollowRequests = () => {
    const ThemedColor = useThemeColor();
    const styles = stylesheet(ThemedColor);

    const onPress = async () => {
        const isAvailable = await SMS.isAvailableAsync();
        if (!isAvailable) {
            alert("SMS is not available on this device");
        } else {
            await SMS.sendSMSAsync(" ", "Join me on Kindred!");
        }
    };

    return (
        <ThemedView style={styles.container}>
            <View style={styles.headerContainer}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="chevron-back" size={24} color={ThemedColor.text} />
                </TouchableOpacity>
                <ThemedText type="subtitle">Friend Requests</ThemedText>
            </View>
            <ScrollView style={styles.scrollViewContent}>
                {follow_requests.length > 0 && (
                    <View style={styles.section}>
                        {follow_requests.map((request, index) => (
                            <View style={styles.listItem} key={`follow-${index}`}>
                                <UserInfoFollowRequest
                                    name={request.name}
                                    icon={request.icon}
                                    username={request.username}
                                    userId={request.userId}
                                />
                            </View>
                        ))}
                    </View>
                )}

                <View style={styles.inviteSection}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>
                        Invite Friends
                    </ThemedText>
                    <View style={styles.inviteContent}>
                        <Text style={styles.emojiIcon}>✉️</Text>
                        <ThemedText type="lightBody">Invite your friends to unlock rewards!</ThemedText>
                        <PrimaryButton style={styles.inviteButton} title={"Invite"} onPress={onPress} />
                    </View>
                </View>
            </ScrollView>
        </ThemedView>
    );
};

const stylesheet = (ThemedColor) =>
    StyleSheet.create({
        container: {
            flex: 1,
            paddingTop: Dimensions.get("window").height * 0.1,
            backgroundColor: ThemedColor.background,
        },
        headerContainer: {
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: HORIZONTAL_PADDING,
            paddingVertical: 10,
            gap: 16,
        },
        scrollViewContent: {
            paddingHorizontal: HORIZONTAL_PADDING,
            paddingBottom: Dimensions.get("window").height * 0.1,
        },
        section: {
            marginBottom: 24,
        },
        listItem: {
            marginVertical: 10,
        },
        sectionTitle: {
            marginBottom: 16,
        },
        inviteSection: {
            marginTop: 16,
            marginBottom: 32,
        },
        inviteContent: {
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            backgroundColor: ThemedColor.lightened,
            borderRadius: 16,
            padding: 24,
        },
        emojiIcon: {
            fontSize: 128,
            lineHeight: 128,
        },
        inviteButton: {
            width: "35%",
            paddingVertical: 12,
            marginTop: 12,
        },
    });

export default FollowRequests;

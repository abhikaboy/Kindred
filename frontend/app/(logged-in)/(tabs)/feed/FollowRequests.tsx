import { Dimensions, StyleSheet, View, ScrollView, TouchableOpacity } from "react-native";
import React, { ReactNode } from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import Ionicons from "@expo/vector-icons/Ionicons";
import UserInfoFollowRequest from "@/components/UserInfo/UserInfoFollowRequest";
import UserInfoCommentNotification from "@/components/UserInfo/UserInfoCommentNotification";
import UserInfoEncouragementNotification from "@/components/UserInfo/UserInfoEncouragementNotification";
import { Icons } from "@/constants/Icons";
import { router } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/Layout";

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
    const styles = stylesheet(useThemeColor);
    const ThemedColor = useThemeColor();

    return (
        <ThemedView style={styles.container}>
            <View style={styles.headerContainer}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="chevron-back" size={24} color={ThemedColor.text} />
                </TouchableOpacity>
                <ThemedText type="subtitle">Friend Reqeusts</ThemedText>
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
            </ScrollView>
        </ThemedView>
    );
};

const stylesheet = (ThemedColor: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            paddingTop: Dimensions.get("window").height * 0.1,
        },
        headerContainer: {
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: HORIZONTAL_PADDING,
            paddingVertical: 10,
        },
        scrollViewContent: {
            paddingHorizontal: HORIZONTAL_PADDING,
        },
        section: {
            marginBottom: 16,
        },
        listItem: {
            marginVertical: 10,
        },
    });

export default FollowRequests;

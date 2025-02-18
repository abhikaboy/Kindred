import { StyleSheet, ScrollView, Image, Dimensions, View, TouchableOpacity } from "react-native";

import ParallaxScrollView from "@/components/ParallaxScrollView";
import { ThemedText } from "@/components/ThemedText";
import { IconSymbol } from "@/components/ui/IconSymbol";
import React from "react";
import { Colors } from "@/constants/Colors";
import { Icons } from "@/constants/Icons";
import { LinearGradient } from "expo-linear-gradient";
import FollowButton from "@/components/inputs/FollowButton";
import ActivityPoint from "@/components/profile/ActivityPoint";
import TaskCard from "@/components/cards/TaskCard";
import { useRouter } from "expo-router";

export default function Profile() {
    const router = useRouter();
    return (
        <ScrollView
            style={{
                backgroundColor: Colors.dark.background,
                padding: 0,
            }}>
            <LinearGradient
                // Background Linear Gradient
                colors={["transparent", Colors.dark.background]}
                style={[styles.headerImage, { position: "absolute", top: 0, left: 0, zIndex: 2 }]}
            />
            <Image src={Icons.luffy} style={styles.headerImage} />
            <View
                style={{
                    top: Dimensions.get("window").height * 0.4 - 50,
                    height: Dimensions.get("window").height * 0.4,
                    flexDirection: "row",
                    flex: 1,
                    alignItems: "baseline",
                    paddingHorizontal: 24,
                    gap: 8,
                }}>
                <ThemedText
                    type="hero"
                    style={{
                        fontWeight: "700",
                        zIndex: 3,
                    }}>
                    Coffee
                </ThemedText>
                <ThemedText
                    style={{
                        zIndex: 3,
                        color: Colors.dark.caption,
                    }}>
                    @Coffee
                </ThemedText>
            </View>
            <View style={{ flex: 1, paddingHorizontal: 24, gap: 16, marginTop: 24 }}>
                <View
                    style={{
                        display: "flex",
                        flexDirection: "row",
                        justifyContent: "space-between",
                        padding: 0,
                        paddingRight: 16,
                        alignItems: "center",
                        width: "100%",
                    }}>
                    <FollowButton following={false} />
                    <ThemedText type="lightBody">17 Friends</ThemedText>
                    <ThemedText type="lightBody">302 Tasks</ThemedText>
                </View>
                <View style={{ gap: 16 }}>
                    <ThemedText type="subtitle">Today</ThemedText>
                    <View
                        style={{
                            display: "flex",
                            flexDirection: "row",
                            gap: 16,
                            alignItems: "center",
                            justifyContent: "space-between",
                            width: "100%",
                            paddingHorizontal: 12,
                        }}>
                        <ThemedText type="lightBody">✅ 4 Tasks</ThemedText>
                        <ThemedText type="lightBody">🔥 3 Streak</ThemedText>
                        <ThemedText type="lightBody">💰 14 Points</ThemedText>
                    </View>
                </View>
                <View gap={16}>
                    <ThemedText type="subtitle">Past 7 Day</ThemedText>
                    <View
                        style={{
                            display: "flex",
                            flexDirection: "row",
                            gap: 16,
                            width: "100%",
                            justifyContent: "space-between",
                        }}>
                        {[1, 2, 1, 3, 3, 4, 2].map((item, index) => (
                            <ActivityPoint key={index} level={item} />
                        ))}
                    </View>
                    <TouchableOpacity
                        onPress={() => router.push("/activity")}
                        style={{
                            alignSelf: "flex-end",
                        }}>
                        <ThemedText type="lightBody">see more</ThemedText>
                    </TouchableOpacity>
                </View>
                <View gap={12}>
                    <ThemedText type="subtitle">Active Tasks</ThemedText>
                    <TaskCard content={"do my hw lol"} points={9} priority="high" />
                </View>
                <View gap={12}>
                    <ThemedText type="subtitle">Accomplished</ThemedText>
                    <TaskCard content={"do my hw lol"} points={9} priority="high" />
                    <TaskCard content={"do my hw lol"} points={9} priority="high" />
                    <TaskCard content={"do my hw lol"} points={9} priority="high" />
                    <TaskCard content={"do my hw lol"} points={9} priority="high" />
                    <TaskCard content={"do my hw lol"} points={9} priority="high" />
                    <TaskCard content={"do my hw lol"} points={9} priority="high" />
                </View>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    headerImage: {
        width: Dimensions.get("window").width,
        height: Dimensions.get("window").height * 0.4,
        position: "absolute",
    },
    titleContainer: {
        flexDirection: "row",
        gap: 8,
    },
});

import { StyleSheet, ScrollView, Image, Dimensions, View, TouchableOpacity } from "react-native";

import ParallaxScrollView from "@/components/ParallaxScrollView";
import { ThemedText } from "@/components/ThemedText";
import { IconSymbol } from "@/components/ui/IconSymbol";
import React, { useEffect, useRef, useState } from "react";
import { Colors } from "@/constants/Colors";
import { Icons } from "@/constants/Icons";
import { LinearGradient } from "expo-linear-gradient";
import FollowButton from "@/components/inputs/FollowButton";
import ActivityPoint from "@/components/profile/ActivityPoint";
import TaskCard from "@/components/cards/TaskCard";
import { useRouter } from "expo-router";
import Animated, { interpolate, useAnimatedRef, useAnimatedStyle, useScrollViewOffset } from "react-native-reanimated";
import { useAuth } from "@/hooks/useAuth";

export default function Profile() {
    const { user } = useAuth();

    const router = useRouter();

    const nameRef = useRef<View>(null);
    const [nameHeight, setNameHeight] = useState(0);

    const scrollRef = useAnimatedRef<Animated.ScrollView>();
    const scrollOffset = useScrollViewOffset(scrollRef);

    useEffect(() => {
        if (nameRef.current) {
            nameRef.current.measure((x, y, width, height, pageX, pageY) => {
                setNameHeight(height);
            });
        }
    }, [nameRef]);

    const HEADER_HEIGHT = Dimensions.get("window").height * 0.4;
    const headerAnimatedStyle = useAnimatedStyle(() => {
        return {
            transform: [
                {
                    translateY: interpolate(
                        scrollOffset.value,
                        [-HEADER_HEIGHT, 0, HEADER_HEIGHT],
                        [-HEADER_HEIGHT / 2, 0, HEADER_HEIGHT * 0.45]
                    ),
                },
                {
                    scale: interpolate(scrollOffset.value, [-HEADER_HEIGHT, 0, HEADER_HEIGHT], [1.5, 1, 1]),
                },
            ],
        };
    });

    return (
        <Animated.ScrollView
            ref={scrollRef}
            scrollEventThrottle={16}
            style={{
                backgroundColor: Colors.dark.background,
                padding: 0,
            }}>
            <Animated.View style={[headerAnimatedStyle]}>
                <LinearGradient
                    // Background Linear Gradient
                    colors={["transparent", Colors.dark.background]}
                    style={[styles.headerImage, { position: "absolute", top: 0, left: 0, zIndex: 2 }]}
                />
                <Animated.Image src={user.profile_picture} style={[styles.headerImage]} />
            </Animated.View>
            <View
                ref={nameRef}
                style={{
                    top: Dimensions.get("window").height * 0.4 - nameHeight,
                    flexDirection: "row",
                    flex: 1,
                    alignItems: "flex-end",
                    paddingHorizontal: 24,
                    gap: 8,
                }}>
                <ThemedText
                    type="hero"
                    style={{
                        fontWeight: "700",
                        zIndex: 3,
                        verticalAlign: "top",
                    }}>
                    {user.display_name}
                </ThemedText>
                <ThemedText
                    style={{
                        zIndex: 3,
                        color: Colors.dark.caption,
                        bottom: 8, // 16 px font / 2 = 8 px
                    }}>
                    {user.handle}
                </ThemedText>
            </View>
            <View
                style={{
                    flex: 1,
                    paddingHorizontal: 24,
                    gap: 16,
                    marginTop: 24 + Dimensions.get("window").height * 0.4 - nameHeight,
                }}>
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
                    <ThemedText type="lightBody">{user.friends.length} Friends</ThemedText>
                    <ThemedText type="lightBody">{user.tasks_complete} Tasks Done</ThemedText>
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
                        onPress={() => router.push("/Activity")}
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
        </Animated.ScrollView>
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

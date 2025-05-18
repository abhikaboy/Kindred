import { StyleSheet, ScrollView, Image, Dimensions, View, TouchableOpacity } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import React, { useEffect, useRef, useState } from "react";
import { Icons } from "@/constants/Icons";
import { LinearGradient } from "expo-linear-gradient";
import ActivityPoint from "@/components/profile/ActivityPoint";
import { useRouter } from "expo-router";
import Animated, { interpolate, useAnimatedRef, useAnimatedStyle, useScrollViewOffset } from "react-native-reanimated";
import { useAuth } from "@/hooks/useAuth";
import { useThemeColor } from "@/hooks/useThemeColor";
import TaskTabs from "@/components/inputs/TaskTabs";
import ConditionalView from "@/components/ui/ConditionalView";
import ProfileStats from "@/components/profile/ProfileStats";
import TodayStats from "@/components/profile/TodayStats";
import ProfileGallery from "@/components/profile/ProfileGallery";
import ProfileHeader from "@/components/profile/ProfileHeader";
import WeeklyActivity from "@/components/profile/WeeklyActivity";
import TaskList from "@/components/profile/TaskList";

export default function Profile() {
    const { user } = useAuth();
    let ThemedColor = useThemeColor();
    const router = useRouter();

    const nameRef = useRef<View>(null);
    const [nameHeight, setNameHeight] = useState(0);
    const [activeTab, setActiveTab] = useState(0);

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
            ] as const,
        };
    });

    const mockTasks = {
        activeTasks: [{ id: "active-1", content: "do my hw lol", value: 9, priority: 1 as const }],
        todayTasks: [{ id: "today-1", content: "do my hw lol", value: 9, priority: 1 as const, encourage: true }],
        completedTasks: [
            { id: "done-1", content: "do my hw lol", value: 3, priority: 1 as const },
            { id: "done-2", content: "do my hw lol", value: 2, priority: 2 as const },
        ],
    };

    return (
        <Animated.ScrollView
            ref={scrollRef}
            scrollEventThrottle={16}
            style={[styles.scrollView, { backgroundColor: ThemedColor.background }]}>
            <Animated.View style={[headerAnimatedStyle]}>
                <LinearGradient
                    colors={["transparent", ThemedColor.background]}
                    style={[styles.headerImage, styles.gradientOverlay]}
                />
                <LinearGradient
                    colors={[ThemedColor.background + "40", ThemedColor.background + "40"]}
                    style={[styles.headerImage, styles.gradientOverlay]}
                />
                <Animated.Image src={user?.profile_picture || Icons.luffy} style={[styles.headerImage]} />
            </Animated.View>

            <ProfileHeader displayName={user?.display_name || ""} handle={user?.handle || ""} nameHeight={nameHeight} />

            <View
                style={[
                    styles.contentContainer,
                    { marginTop: 24 + Dimensions.get("window").height * 0.4 - nameHeight },
                ]}>
                <View style={{ width: "100%" }}>
                    <ProfileStats friendsCount={user?.friends.length || 0} />
                </View>

                <TodayStats tasks={2} points={12} streak={242} posts={4} />

                <WeeklyActivity activityLevels={[4, 4, 4, 3, 2, 1, 4, 2]} />

                <TaskTabs tabs={["Tasks", "Gallery"]} activeTab={activeTab} setActiveTab={setActiveTab} />

                <ConditionalView condition={activeTab == 0}>
                    <TaskList {...mockTasks} />
                </ConditionalView>

                <ConditionalView condition={activeTab == 1}>
                    <ProfileGallery images={new Array(28).fill("https://picsum.photos/200")} />
                </ConditionalView>
            </View>
        </Animated.ScrollView>
    );
}

const styles = StyleSheet.create({
    scrollView: {
        padding: 0,
    },
    headerImage: {
        width: Dimensions.get("window").width,
        height: Dimensions.get("window").height * 0.4,
        position: "absolute",
    },
    gradientOverlay: {
        position: "absolute",
        top: 0,
        left: 0,
        zIndex: 2,
    },
    contentContainer: {
        flex: 1,
        paddingHorizontal: 20,
        gap: 28,
        paddingBottom: 128,
        width: "100%",
    },
    section: {
        gap: 16,
    },
});

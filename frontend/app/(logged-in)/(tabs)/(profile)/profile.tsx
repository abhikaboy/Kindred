import { StyleSheet, ScrollView, Image, Dimensions, View, TouchableOpacity } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import React, { useEffect, useRef, useState, useMemo } from "react";
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
import ParallaxBanner from "@/components/ui/ParallaxBanner";
import ProfileEdit from "@/components/profile/ProfileEdit";

export default function Profile() {
    const { user } = useAuth();
    let ThemedColor = useThemeColor();

    console.log("Profile component - user:", user);
    console.log("Profile component - user?._id:", user?._id);
    console.log("Profile component - user?.handle:", user?.handle);
    console.log("Profile component - user?.display_name:", user?.display_name);

    const [activeTab, setActiveTab] = useState(0);

    const scrollRef = useAnimatedRef<Animated.ScrollView>();

    const HEADER_HEIGHT = Dimensions.get("window").height * 0.4;

    // Use useMemo to recalculate mockTasks when user changes
    const mockTasks = useMemo(
        () => ({
            activeTasks: [{ id: "active-1", content: "do my hw lol", value: 9, priority: 1 as const }],
            todayTasks: user?._id
                ? [{ id: "today-1", content: "do my hw lol", value: 9, priority: 1 as const, encourage: true }]
                : [],
            completedTasks: [
                { id: "done-1", content: "do my hw lol", value: 3, priority: 1 as const },
                { id: "done-2", content: "do my hw lol", value: 2, priority: 2 as const },
            ],
        }),
        [user?._id]
    );

    console.log("Profile component - mockTasks:", mockTasks);
    console.log("Profile component - todayTasks length:", mockTasks.todayTasks.length);

    return (
        <Animated.ScrollView
            ref={scrollRef}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
            style={[styles.scrollView, { backgroundColor: ThemedColor.background }]}>
            <ParallaxBanner
                scrollRef={scrollRef}
                backgroundImage={user?.profile_picture || Icons.luffy}
                backgroundColor={ThemedColor.background}
                headerHeight={HEADER_HEIGHT}
            />
            <ProfileHeader displayName={user?.display_name || ""} handle={user?.handle || ""} />

            <View style={[styles.contentContainer, { marginTop: 24 + HEADER_HEIGHT }]}>
                <View style={{ width: "100%" }}>
                    <ProfileEdit friendsCount={user?.friends.length || 0} />
                </View>

                <TodayStats tasks={2} points={12} streak={242} posts={4} />

                <WeeklyActivity activityLevels={[4, 4, 4, 3, 2, 1, 4, 2]} userid={user?._id} />

                <TaskTabs tabs={["Tasks", "Gallery"]} activeTab={activeTab} setActiveTab={setActiveTab} />

                <ConditionalView condition={activeTab == 0}>
                    <TaskList
                        {...mockTasks}
                        encouragementConfig={
                            user?._id
                                ? {
                                      userHandle: user?.handle,
                                      receiverId: user._id,
                                      categoryName: "Profile Tasks",
                                  }
                                : undefined
                        }
                    />
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

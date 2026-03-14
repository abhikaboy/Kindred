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
import AnimatedTabs, { AnimatedTabContent } from "@/components/inputs/AnimatedTabs";
import ProfileStats from "@/components/profile/ProfileStats";
import TodayStats from "@/components/profile/TodayStats";
import ProfileGallery from "@/components/profile/ProfileGallery";
import ProfileHeader from "@/components/profile/ProfileHeader";
import WeeklyActivity from "@/components/profile/WeeklyActivity";
import TaskList from "@/components/profile/TaskList";
import ParallaxBanner from "@/components/ui/ParallaxBanner";
import ProfileEdit from "@/components/profile/ProfileEdit";
import BlueprintSection from "@/components/profile/BlueprintSection";
import ReferralCard from "@/components/profile/ReferralCard";
import { components } from "@/api/generated/types";
import { useTasks } from "@/contexts/tasksContext";
import { useQuery } from "@tanstack/react-query";
import { getCompletedTasksAPI } from "@/api/task";



export default function Profile() {
    const { user } = useAuth();
    const { startTodayTasks, dueTodayTasks, windowTasks } = useTasks();
    let ThemedColor = useThemeColor();

    const [activeTab, setActiveTab] = useState(0);

    const scrollRef = useAnimatedRef<Animated.ScrollView>();

    const HEADER_HEIGHT = Dimensions.get("screen").height * 0.4;

    type TaskDocument = components["schemas"]["TaskDocument"];

    const { data: completedTasksData } = useQuery({
        queryKey: ["completedTasks", "profile"],
        queryFn: () => getCompletedTasksAPI(1, 10),
    });

    const tasks = useMemo(() => {
        const uniqueTasks = Array.from(
            new Map(
                [...startTodayTasks, ...dueTodayTasks, ...windowTasks]
                    .filter(task => task.public)
                    .map(task => [task.id, task])
            ).values()
        );

        const todayTasks = uniqueTasks.map(task => ({
            id: task.id,
            content: task.content,
            value: task.value,
            priority: task.priority as 1 | 2 | 3,
            encourage: false,
            categoryName: (task as any).categoryName || task.categoryID
        }));

        const completedTasks = (completedTasksData?.tasks || []).slice(0, 10).map((task: any) => ({
            id: task.id,
            content: task.content,
            value: task.value || 0,
            priority: (task.priority || 1) as 1 | 2 | 3,
            categoryName: task.categoryName || task.categoryID || "",
        }));

        return {
            todayTasks,
            completedTasks,
            activeTasks: [],
            encouragementConfig: {
                userHandle: user?.handle,
                receiverId: user?._id,
                categoryName: "Encouragement",
            },
        };
    }, [startTodayTasks, dueTodayTasks, windowTasks, user, completedTasksData]);


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
            <ProfileHeader displayName={user?.display_name || ""} handle={user?.handle || ""} userId={user?._id} />

            <View style={[styles.contentContainer, { marginTop: 24 + HEADER_HEIGHT }]}>
                <View style={{ width: "100%" }}>
                    <ProfileEdit friendsCount={user?.friends.length || 0} />
                </View>

                <TodayStats userId={user?._id} />

                <ReferralCard />

                <WeeklyActivity userid={user?._id} displayName={user?.display_name} />

                {user?._id && (
                    <BlueprintSection
                        userId={user._id}
                        title="My Blueprints"
                        showViewAll={true}
                    />
                )}

                <AnimatedTabs tabs={["Tasks", "Gallery"]} activeTab={activeTab} setActiveTab={setActiveTab} />

                <AnimatedTabContent activeTab={activeTab} setActiveTab={setActiveTab}>
                    <TaskList {...tasks} />
                    <ProfileGallery userId={user?._id} />
                </AnimatedTabContent>
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

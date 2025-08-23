import { StyleSheet, ScrollView, Image, Dimensions, View, TouchableOpacity, ActivityIndicator } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import React, { useEffect, useRef, useState, useMemo } from "react";
import { Icons } from "@/constants/Icons";
import { LinearGradient } from "expo-linear-gradient";
import ActivityPoint from "@/components/profile/ActivityPoint";
import { useLocalSearchParams, useRouter } from "expo-router";
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
import FollowButton from "@/components/inputs/FollowButton";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getProfile } from "@/api/profile";
import { type Profile, type RelationshipStatus} from "@/api/types";
import { components } from "@/api/generated/types";

export default function Profile() {
    const { id } = useLocalSearchParams();
    const queryClient = useQueryClient();
    const { user } = useAuth();

    type TaskDocument = components["schemas"]["TaskDocument"];
    type ProfileDocument = components["schemas"]["ProfileDocument"];


    const fallback_profile = {
        id: "67ef139d4931ee7a9fb630fc",
        display_name: "Coffee!~",
        handle: "@coffee",
        profile_picture: Icons.coffee,
        friends: [{ id: "friend-1", display_name: "Jane Doe", handle: "jane_doe", profile_picture: Icons.luffy }],
    };
    // 67ef139d4931ee7a9fb630fc
    let ThemedColor = useThemeColor();

    const [activeTab, setActiveTab] = useState(0);

    const scrollRef = useAnimatedRef<Animated.ScrollView>();

    const HEADER_HEIGHT = Dimensions.get("window").height * 0.4;

    const { data: profile, isLoading } = useQuery({
        queryKey: ["profile", id],
        queryFn: () => getProfile(id as string),
        enabled: !!id,
    }) as any; // Type assertion until profile types are aligned


    // Only show encourage tasks when profile data is loaded
    const tasks = useMemo(() => {
        if (profile?.tasks?.length > 0)
            return {
                todayTasks: profile?.tasks.map((task : TaskDocument) => ({ ...task, encourage: true, categoryName: task.categoryID })),
                completedTasks: [],
                activeTasks: [],
                encouragementConfig: {
                    userHandle: profile?.handle,
                    receiverId: profile?.id,
                    categoryName: "Encouragement",
                },
            };

        const tasks = {
            todayTasks: [],
            completedTasks: [],
        };
        return tasks;
    }, [profile]);

    // Handle relationship changes
    const handleRelationshipChange = (newStatus: RelationshipStatus, requestId?: string) => {
        if (profile) {
            // Update the profile data in the cache
            queryClient.setQueryData(["profile", id], {
                ...profile,
                relationship: {
                    status: newStatus,
                    request_id: requestId,
                },
            });
        }
    };
    const galleryUserId = (id as string) || user?._id;
    if (isLoading) {
        return <ActivityIndicator />;
    }

    return (
        <Animated.ScrollView
            ref={scrollRef}
            scrollEventThrottle={16}
            style={[styles.scrollView, { backgroundColor: ThemedColor.background }]}>
            <ParallaxBanner
                scrollRef={scrollRef}
                backgroundImage={profile?.profile_picture || Icons.luffy}
                backgroundColor={ThemedColor.background}
                headerHeight={HEADER_HEIGHT}
            />
            <ProfileHeader displayName={profile?.display_name || ""} handle={profile?.handle || ""} />

            <View style={[styles.contentContainer, { marginTop: 24 + HEADER_HEIGHT }]}>
                <View style={{ width: "100%" }}>
                    <ProfileStats
                        friendsCount={profile?.friends?.length || 0}
                        profileUserId={profile?.id}
                        profile={profile}
                        onRelationshipChange={handleRelationshipChange}
                    />
                </View>

                <TodayStats userId={profile?.id} />

                <WeeklyActivity userid={profile?.id} />

                <TaskTabs tabs={["Tasks", "Gallery"]} activeTab={activeTab} setActiveTab={setActiveTab} />

                <ConditionalView condition={activeTab == 0}>
                    <TaskList {...tasks} />
                </ConditionalView>

                <ConditionalView condition={activeTab == 1}>
                    <ProfileGallery userId={galleryUserId} />
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
    followButtonContainer: {
        width: "100%",
        alignItems: "center",
    },
    section: {
        gap: 16,
    },
});

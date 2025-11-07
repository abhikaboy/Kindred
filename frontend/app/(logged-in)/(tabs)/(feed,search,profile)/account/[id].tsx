import { StyleSheet, ScrollView, Image, Dimensions, View, TouchableOpacity, ActivityIndicator, useColorScheme } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import React, { useEffect, useRef, useState, useMemo } from "react";
import { Icons } from "@/constants/Icons";
import { SvgUri } from "react-native-svg";
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
import BlueprintSection from "@/components/profile/BlueprintSection";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getProfile } from "@/api/profile";
import { type Profile, type RelationshipStatus} from "@/api/types";
import { components } from "@/api/generated/types";
import { useBlueprints } from "@/contexts/blueprintContext";
import { getBlueprintById } from "@/api/blueprint";
import ProfileEncouragementCard from "@/components/cards/ProfileEncouragementCard";

export default function Profile() {
    const { id, blueprintId } = useLocalSearchParams();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const { setSelectedBlueprint } = useBlueprints();
    const colorScheme = useColorScheme();

    type TaskDocument = components["schemas"]["TaskDocument"];
    type ProfileDocument = components["schemas"]["ProfileDocument"];

    // Fetch blueprint by ID if provided in search params
    const { data: blueprint } = useQuery({
        queryKey: ["blueprint", blueprintId],
        queryFn: () => getBlueprintById(blueprintId as string),
        enabled: !!blueprintId,
    });

    // Set selected blueprint when blueprint data is loaded
    useEffect(() => {
        if (blueprint) {
            setSelectedBlueprint(blueprint);
        }
    }, [blueprint, setSelectedBlueprint]);


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

    // Check if user can view personal content (friends or self)
    const canViewPersonalContent = useMemo(() => {
        if (!profile?.relationship) return false;
        return profile.relationship.status === "connected" || profile.relationship.status === "self";
    }, [profile?.relationship]);

    const galleryUserId = (id as string) || user?._id;
    if (isLoading) {
        return <ActivityIndicator />;
    }

    // Handle account not found
    if (!profile || !profile.id) {
        return (
            <Animated.ScrollView
                ref={scrollRef}
                scrollEventThrottle={16}
                style={[styles.scrollView, { backgroundColor: ThemedColor.background }]}>
                <ParallaxBanner
                    scrollRef={scrollRef}
                    backgroundImage={Icons.luffy}
                    backgroundColor={ThemedColor.background}
                    headerHeight={HEADER_HEIGHT}
                />
                <ProfileHeader displayName="Account not found" handle="" />
            </Animated.ScrollView>
        );
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
            <ProfileHeader displayName={profile?.display_name || ""} handle={profile?.handle || ""} userId={profile?.id} />

            <View style={[styles.contentContainer, { marginTop: 20 + HEADER_HEIGHT }]}>
                <View style={{ gap: 16 }}>

                <View style={{ width: "100%" }}>
                    <ProfileStats
                        friendsCount={profile?.friends?.length || 0}
                        profileUserId={profile?.id}
                        profile={profile}
                        onRelationshipChange={handleRelationshipChange}
                    />
                </View>
                { canViewPersonalContent && (

                    <View>
                    <ProfileEncouragementCard 
                        userId={profile?.id} 
                        userHandle={profile?.handle}
                        userName={profile?.display_name}
                        />
                </View>
                    )}
                <TodayStats userId={profile?.id} />
                </View>
                {canViewPersonalContent ? (
                    <>

                        <WeeklyActivity userid={profile?.id} />

                        {profile?.id && (
                            <BlueprintSection 
                                userId={profile.id} 
                                title={`${profile.display_name}'s Blueprints`}
                                showViewAll={true}
                            />
                        )}

                        <TaskTabs tabs={["Tasks", "Gallery"]} activeTab={activeTab} setActiveTab={setActiveTab} />

                        <ConditionalView condition={activeTab == 0}>
                            <TaskList {...tasks} />
                        </ConditionalView>

                        <ConditionalView condition={activeTab == 1}>
                            <ProfileGallery userId={galleryUserId} />
                        </ConditionalView>
                    </>
                ) : (
                    <View style={styles.privateProfileContainer}>
                        <Image 
                            source={require('@/assets/images/185-Analysing.png')}
                            style={[
                                styles.privateProfileImage,
                                colorScheme === 'dark' && styles.invertedImage
                            ]}
                            resizeMode="contain"
                        />
                        <ThemedText type="subtitle" style={{ textAlign: 'center', marginBottom: 8 }}>
                            This profile is private
                        </ThemedText>
                        <ThemedText style={{ textAlign: 'center', opacity: 0.7 }}>
                            Connect with {profile.display_name} to see their activity, tasks, and posts
                        </ThemedText>
                    </View>
                )}
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
    privateProfileContainer: {
        paddingVertical: 60,
        paddingHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    privateProfileImage: {
        width: Dimensions.get("window").width * 0.75,
        height: Dimensions.get("window").width * 0.75,
        marginBottom: 24,
        marginTop: -32,
    },
    invertedImage: {
        tintColor: '#ffffff',
    },
});

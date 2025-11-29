import React, { useMemo } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import BlueprintCard from "@/components/cards/BlueprintCard";
import Animated, { FadeIn, FadeOut, Layout } from "react-native-reanimated";
import type { components } from "@/api/generated/types";
import FollowButton from "../inputs/FollowButton";
import { useThemeColor } from "@/hooks/useThemeColor";
import UserInfoRowBase from "../UserInfo/UserInfoRowBase";
import { useRouter } from "expo-router";
import { SearchResultsSkeleton } from "../ui/SkeletonLoader";
import { Profile, RelationshipStatus } from "@/api/types";

type BlueprintDocument = components["schemas"]["BlueprintDocument"];
type ProfileDocument = components["schemas"]["ProfileDocument"];

const convertToProfile = (profileDoc: ProfileDocument): Profile => {
    return {
        id: profileDoc.id,
        display_name: profileDoc.display_name,
        handle: profileDoc.handle,
        profile_picture: profileDoc.profile_picture,
        tasks_complete: profileDoc.tasks_complete,
        friends: profileDoc.friends,
        relationship: profileDoc.relationship
            ? {
                  status: profileDoc.relationship.status as RelationshipStatus,
                  request_id: profileDoc.relationship.request_id,
              }
            : undefined,
    };
};

type SearchResultsProps = {
    mode: "searching" | "results" | "no-results";
    searchResults: BlueprintDocument[];
    userResults: ProfileDocument[];
    searchTerm: string;
    focusStyle: any;
    activeTab: number;
    setActiveTab: (tab: number) => void;
    showTabs?: boolean;
};

export const SearchResults: React.FC<SearchResultsProps> = ({
    mode,
    searchResults,
    userResults,
    searchTerm,
    focusStyle,
    activeTab,
    setActiveTab,
    showTabs = true,
}) => {
    const ThemedColor = useThemeColor();
    const styles = useStyles(ThemedColor);
    const router = useRouter();

    const tabs = ["Blueprints", "Users"];

    const TabHeader = useMemo(() => {
        if (!showTabs) return null;
        return (
            <View style={styles.tabsContainer}>
                <View style={[styles.tabHeaderContainer, { borderBottomColor: ThemedColor.tertiary }]}>
                    {tabs.map((tab, index) => (
                        <TouchableOpacity
                            key={`tab-${tab}`}
                            style={[
                                styles.tab,
                                activeTab === index && {
                                    borderBottomWidth: 2,
                                    borderBottomColor: ThemedColor.primary,
                                    marginBottom: -1,
                                },
                            ]}
                            onPress={() => setActiveTab(index)}
                            activeOpacity={0.7}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <ThemedText
                                style={[
                                    styles.tabText,
                                    {
                                        color: activeTab === index ? ThemedColor.text : ThemedColor.caption,
                                        fontWeight: activeTab === index ? "600" : "500",
                                    },
                                ]}>
                                {tab}
                            </ThemedText>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
        );
    }, [activeTab, ThemedColor, styles, setActiveTab, showTabs]);

    const BlueprintContent = useMemo(() => {
        if (mode === "searching") return null;

        const hasBlueprints = searchResults && searchResults.length > 0;

        return (
            <View style={{ display: activeTab === 0 ? "flex" : "none" }}>
                <ThemedText type="default" style={styles.searchResultsHeader}>
                    {hasBlueprints ? `${searchResults.length} Results` : "No Results"}
                </ThemedText>
                <View style={styles.searchResultsContainer}>
                    {hasBlueprints ? (
                        searchResults.map((blueprint) => (
                            <View key={blueprint.id} style={styles.searchResultItem}>
                                <BlueprintCard {...blueprint} large={true} />
                            </View>
                        ))
                    ) : (
                        <View style={styles.noResultsContainer}>
                            <ThemedText style={styles.noResultsText}>No blueprints found for "{searchTerm}"</ThemedText>
                        </View>
                    )}
                </View>
            </View>
        );
    }, [mode, searchResults, searchTerm, activeTab, styles]);

    const UserContent = useMemo(() => {
        if (mode === "searching") return null;

        const hasUsers = userResults && userResults.length > 0;

        return (
            <View style={{ display: activeTab === 1 ? "flex" : "none" }}>
                <ThemedText type="default" style={styles.searchResultsHeader}>
                    {hasUsers ? `${userResults.length} Results` : "No Results"}
                </ThemedText>
                <View style={styles.searchResultsContainer}>
                    {hasUsers ? (
                        userResults.map((user) => (
                            <TouchableOpacity
                                key={user.id}
                                style={styles.searchResultItem}
                                onPress={() => router.push(`/account/${user.id}`)}>
                                <UserInfoRowBase
                                    name={user.display_name}
                                    username={user.handle}
                                    icon={user.profile_picture}
                                    id={user.id}
                                    right={
                                        <View>
                                            <FollowButton profile={convertToProfile(user)} />
                                        </View>
                                    }
                                />
                            </TouchableOpacity>
                        ))
                    ) : (
                        <View style={styles.noResultsContainer}>
                            <ThemedText style={styles.noResultsText}>No users found for "{searchTerm}"</ThemedText>
                        </View>
                    )}
                </View>
            </View>
        );
    }, [mode, userResults, searchTerm, activeTab, router, styles]);

    return (
        <Animated.View style={[focusStyle]} exiting={FadeOut}>
            {TabHeader}

            {mode === "searching" ? (
                <SearchResultsSkeleton activeTab={activeTab} />
            ) : (
                <View>
                    {BlueprintContent}
                    {UserContent}
                </View>
            )}
        </Animated.View>
    );
};

export default React.memo(SearchResults);

const useStyles = (ThemedColor: any) =>
    StyleSheet.create({
        searchResultsHeader: {
            paddingHorizontal: 16,
            marginBottom: 8,
        },
        searchingContainer: {
            padding: 20,
            alignItems: "center",
        },
        searchResultsContainer: {
            paddingHorizontal: 16,
            marginBottom: 112,
        },
        searchResultItem: {
            marginBottom: 6,
            backgroundColor: ThemedColor.background,
            borderRadius: 16,
        },
        noResultsContainer: {
            padding: 20,
            alignItems: "center",
        },
        noResultsText: {
            textAlign: "center",
            opacity: 0.7,
        },
        tabsContainer: {
            paddingHorizontal: 16,
            paddingBottom: 4,
        },
        tabHeaderContainer: {
            flexDirection: "row",
            borderBottomWidth: 1,
            marginBottom: 12,
        },
        tab: {
            flex: 1,
            paddingBottom: 16, // Increased for easier tapping
            paddingTop: 12, // Increased for easier tapping
            marginHorizontal: 4, // Added for easier tapping
        },
        tabText: {
            fontSize: 18, // Increased for better visibility
            fontFamily: "Outfit",
            textAlign: "center",
        },
    });

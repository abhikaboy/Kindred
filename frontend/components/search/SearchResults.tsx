import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import BlueprintCard from "@/components/cards/BlueprintCard";
import Animated, { FadeOut } from "react-native-reanimated";
import type { components } from "@/api/generated/types";
import TaskTabs from "../inputs/TaskTabs";
import UserInfoRowFollow from "../UserInfo/UserInfoRowFollow";
import FollowButton from "../inputs/FollowButton";
import { useThemeColor } from "@/hooks/useThemeColor";
import UserInfoRowBase from "../UserInfo/UserInfoRowBase";
import { useRouter } from "expo-router";
import { SearchResultsSkeleton } from "../ui/SkeletonLoader";
import { Profile, RelationshipStatus } from "@/api/types";

type BlueprintDocument = components["schemas"]["BlueprintDocument"];
type ProfileDocument = components["schemas"]["ProfileDocument"];

// Helper function to convert ProfileDocument to Profile
const convertToProfile = (profileDoc: ProfileDocument): Profile => {
    return {
        id: profileDoc.id,
        display_name: profileDoc.display_name,
        handle: profileDoc.handle,
        profile_picture: profileDoc.profile_picture,
        tasks_complete: profileDoc.tasks_complete,
        friends: profileDoc.friends,
        relationship: profileDoc.relationship ? {
            status: profileDoc.relationship.status as RelationshipStatus,
            request_id: profileDoc.relationship.request_id
        } : undefined
    };
};

type SearchResultsProps = {
    mode: 'searching' | 'results' | 'no-results';
    searchResults: BlueprintDocument[];
    userResults: ProfileDocument[];
    searchTerm: string;
    focusStyle: any;
    activeTab: number;
    setActiveTab: (tab: number) => void;
};

export const SearchResults: React.FC<SearchResultsProps> = ({
    mode,
    searchResults,
    userResults,
    searchTerm,
    focusStyle,
    activeTab,
    setActiveTab
}) => {
    const ThemedColor = useThemeColor();
    const styles = useStyles(ThemedColor);
    const router = useRouter();
    if (mode === 'searching') {
        return (
            <Animated.View style={[focusStyle]} exiting={FadeOut}>
                <SearchResultsSkeleton activeTab={activeTab} />
            </Animated.View>
        );
    }

    if (mode === 'results') {
        return (
            <Animated.View style={[focusStyle]} exiting={FadeOut}>
                <View style={styles.tabsContainer}>
                    <TaskTabs 
                        tabs={["Blueprints", "Users"]} 
                        activeTab={activeTab} 
                        setActiveTab={setActiveTab} 
                    />
                </View>
                
                {activeTab === 0 ? (
                    // Blueprints tab
                    <View>
                        <ThemedText type="subtitle" style={styles.searchResultsHeader}>
                            Results
                        </ThemedText>
                        <View style={styles.searchResultsContainer}>
                            {searchResults.map((blueprint) => (
                                <View key={blueprint.id} style={styles.searchResultItem}>
                                    <BlueprintCard {...blueprint} large={true} />
                                </View>
                            ))}
                        </View>
                    </View>
                ) : (
                    // Users tab
                    <View>
                        <ThemedText type="subtitle" style={styles.searchResultsHeader}>
                            Results
                        </ThemedText>
                        <View style={styles.searchResultsContainer}>
                            {userResults.map((user) => (
                                <TouchableOpacity key={user.id} style={styles.searchResultItem} onPress={() => {
                                    router.push(`/account/${user.id}`);
                                }}>
                                    <UserInfoRowBase
                                        name={user.display_name}
                                        username={user.handle}
                                        icon={user.profile_picture}
                                        id={user.id}
                                        right={<View>
                                            <FollowButton profile={convertToProfile(user)} />
                                        </View>}
                                    />
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}
            </Animated.View>
        );
    }

    if (mode === 'no-results') {
        return (
            <Animated.View style={[focusStyle]} exiting={FadeOut}>
                <View style={styles.tabsContainer}>
                    <TaskTabs 
                        tabs={["Blueprints", "Users"]} 
                        activeTab={activeTab} 
                        setActiveTab={setActiveTab} 
                    />
                </View>
                <ThemedText type="subtitle" style={styles.searchResultsHeader}>
                    Results
                </ThemedText>
                <View style={styles.noResultsContainer}>
                    <ThemedText style={styles.noResultsText}>
                        No {activeTab === 0 ? 'blueprints' : 'users'} found for "{searchTerm}"
                    </ThemedText>
                </View>
            </Animated.View>
        );
    }

    return null;
};

const useStyles = (ThemedColor: any) => StyleSheet.create({
    searchResultsHeader: {
        paddingHorizontal: 16,
        marginBottom: 20,
    },
    searchingContainer: {
        padding: 20,
        alignItems: "center",
    },
    searchResultsContainer: {
        paddingHorizontal: 16,
    },
    searchResultItem: {
        marginBottom: 16,
        backgroundColor: ThemedColor.background,
        borderRadius: 16,
        paddingVertical: 8,    
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
});

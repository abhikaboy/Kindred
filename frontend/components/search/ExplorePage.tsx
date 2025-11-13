import React, { useCallback } from "react";
import { View, StyleSheet, FlatList, TouchableOpacity } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import BlueprintCard from "@/components/cards/BlueprintCard";
import ContactCard from "@/components/cards/ContactCard";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useRouter } from "expo-router"; // or your navigation library
import type { components } from "@/api/generated/types";
import { Icons } from "@/constants/Icons";
import { CategorySectionSkeleton } from "../ui/SkeletonLoader";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Href } from "expo-router";

type BlueprintDocument = components["schemas"]["BlueprintDocument"];
type BlueprintCategoryGroup = components["schemas"]["BlueprintCategoryGroup"];

const ThemedColor = useThemeColor();
type ExplorePageProps = {
    categoryGroups: BlueprintCategoryGroup[];
    focusStyle: any;
    loading?: boolean;
};

export const ExplorePage: React.FC<ExplorePageProps> = ({ categoryGroups, focusStyle, loading = false }) => {
    const router = useRouter(); // Initialize router for navigation

    // Handle navigation to category page
    const handleSeeAllPress = useCallback(
        (category: string) => {
            // Since the route is at the same level as search
            router.push(`/category/${category || "uncategorized"}`);
        },
        [router]
    );

    // Memoized render functions for performance
    const renderBlueprint = useCallback(({ item }: { item: BlueprintDocument }) => <BlueprintCard {...item} />, []);

    const renderContacts = useCallback(
        ({ item }) => <ContactCard name={item.name} icon={item.icon} handle={item.handle} following={item.following} />,
        []
    );

    // Memoized category section renderer
    const renderCategorySection = useCallback(
        ({ item }: { item: BlueprintCategoryGroup }) => (
            <View style={styles.categorySection}>
                <View style={styles.categoryHeaderContainer}>
                    <ThemedText type="defaultSemiBold" style={styles.categoryHeader}>
                        {item.category ? item.category : "Uncategorized"}
                    </ThemedText>
                    <TouchableOpacity
                        onPress={() => handleSeeAllPress(item.category)}
                        style={styles.seeAllButton}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <ThemedText type="caption" style={styles.seeAllText}>
                            See All
                        </ThemedText>
                    </TouchableOpacity>
                </View>
                <FlatList
                    data={item.blueprints}
                    renderItem={renderBlueprint}
                    keyExtractor={(blueprint) => blueprint.id}
                    horizontal={true}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.blueprintList}
                    ItemSeparatorComponent={() => <View style={{ width: 4 }} />}
                />
            </View>
        ),
        [renderBlueprint, handleSeeAllPress]
    );

    if (loading) {
        return (
            <Animated.View style={focusStyle} entering={FadeIn} exiting={FadeOut}>
                {/* Category skeletons */}
                <View style={styles.categoriesContainer}>
                    {[...Array(3)].map((_, index) => (
                        <CategorySectionSkeleton key={index} />
                    ))}
                </View>

                {/* Suggested contacts skeleton */}
                <View style={styles.suggestedSection}>
                    <View style={styles.suggestedSkeletonHeader}>
                        <CategorySectionSkeleton />
                    </View>
                </View>
            </Animated.View>
        );
    }

    return (
        <Animated.View style={focusStyle} entering={FadeIn} exiting={FadeOut}>
            {/* Categories with blueprints */}
            <FlatList
                data={categoryGroups}
                renderItem={renderCategorySection}
                keyExtractor={(item) => item.category}
                scrollEnabled={false}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.categoriesContainer}
            />
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    categoriesContainer: {
        gap: 12,
        marginBottom: 112,
    },
    categorySection: {
        marginBottom: 2,
    },
    categoryHeaderContainer: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 16,
        marginBottom: 8,
    },
    categoryHeader: {
        flex: 1,
    },
    seeAllButton: {
        padding: 4,
    },
    seeAllText: {
        color: ThemedColor.primary,
        fontSize: 14,
    },
    blueprintList: {
        paddingHorizontal: 16,
        paddingVertical: 2,
        gap: 8,
    },
    suggestedSection: {
        marginTop: 32,
    },
    suggestedHeader: {
        marginBottom: 16,
        paddingHorizontal: 16,
    },
    contactsList: {
        gap: 16,
        marginTop: 16,
        paddingHorizontal: 16,
    },
    suggestedSkeletonHeader: {
        paddingHorizontal: 16,
    },
});

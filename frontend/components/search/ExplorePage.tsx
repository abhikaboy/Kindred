import React, { useCallback } from "react";
import { View, StyleSheet, FlatList } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import BlueprintCard from "@/components/cards/BlueprintCard";
import ContactCard from "@/components/cards/ContactCard";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import type { components } from "@/api/generated/types";
import { Icons } from "@/constants/Icons";
import { CategorySectionSkeleton } from "../ui/SkeletonLoader";

type BlueprintDocument = components["schemas"]["BlueprintDocument"];
type BlueprintCategoryGroup = components["schemas"]["BlueprintCategoryGroup"];

type ExplorePageProps = {
    categoryGroups: BlueprintCategoryGroup[];
    focusStyle: any;
    loading?: boolean;
};

export const ExplorePage: React.FC<ExplorePageProps> = ({
    categoryGroups,
    focusStyle,
    loading = false
}) => {
    // Mock contacts data - could be moved to props or fetched separately
    const contacts = [
        { id: "1", name: "Abhik Ray", icon: Icons.luffy, handle: "beak", following: true },
        { id: "2", name: "Abhik Ray", icon: Icons.luffy, handle: "beak", following: false },
        { id: "3", name: "Abhik Ray", icon: Icons.luffy, handle: "beak", following: true },
        { id: "4", name: "Abhik Ray", icon: Icons.luffy, handle: "beak", following: false },
    ];

    // Memoized render functions for performance
    const renderBlueprint = useCallback(({ item }: { item: BlueprintDocument }) => (
        <BlueprintCard {...item} />
    ), []);

    const renderContacts = useCallback(({ item }) => (
        <ContactCard name={item.name} icon={item.icon} handle={item.handle} following={item.following} />
    ), []);

    // Memoized category section renderer
    const renderCategorySection = useCallback(({ item }: { item: BlueprintCategoryGroup }) => (
        <View style={styles.categorySection}>
            <ThemedText type="subtitle" style={styles.categoryHeader}>
                {item.category ? item.category : "Uncategorized"}
            </ThemedText>
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
    ), [renderBlueprint]);

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

            {/* Suggested contacts */}
            <View style={styles.suggestedSection}>
                <ThemedText type="subtitle" style={styles.suggestedHeader}>
                    Suggested For You
                </ThemedText>
                <FlatList
                    data={contacts}
                    renderItem={renderContacts}
                    keyExtractor={(item) => item.id}
                    horizontal={true}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.contactsList}
                />
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    categoriesContainer: {
        gap: 32,
    },
    categorySection: {
        marginBottom: 8,
    },
    categoryHeader: {
        marginBottom: 16,
        paddingHorizontal: 16,
    },
    blueprintList: {
        paddingHorizontal: 16,
        gap: 20,
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

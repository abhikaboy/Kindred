import {
    Dimensions,
    StyleSheet,
    ScrollView,
    View,
    Text,
    Pressable,
    Keyboard,
    FlatList,
    RefreshControl,
} from "react-native";
import React, { useEffect, useCallback, useMemo } from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { SearchBox } from "@/components/SearchBox";
import ContactCard from "@/components/cards/ContactCard";
import { Icons } from "@/constants/Icons";
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useThemeColor } from "@/hooks/useThemeColor";
import BlueprintCard from "@/components/cards/BlueprintCard";
import { getBlueprintsByCategoryFromBackend, searchBlueprintsFromBackend } from "@/api/blueprint";
import type { components } from "@/api/generated/types";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type BlueprintDocument = components["schemas"]["BlueprintDocument"];
type BlueprintCategoryGroup = components["schemas"]["BlueprintCategoryGroup"];

type Props = {};

const Search = (props: Props) => {
    const [categoryGroups, setCategoryGroups] = React.useState<BlueprintCategoryGroup[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    const [searchTerm, setSearchTerm] = React.useState("");
    const [searched, setSearched] = React.useState(false);
    const [focused, setFocused] = React.useState(false);
    const [searchResults, setSearchResults] = React.useState<BlueprintDocument[]>([]);
    const [isSearching, setIsSearching] = React.useState(false);
    const [refreshing, setRefreshing] = React.useState(false);
    const ThemedColor = useThemeColor();

    const opacity = useSharedValue(1);
    const focusStyle = useAnimatedStyle(() => {
        return {
            opacity: opacity.value,
            backgroundColor: ThemedColor.background,
        };
    });

    const insets = useSafeAreaInsets();

    // Load blueprints by category
    const loadBlueprintsByCategory = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getBlueprintsByCategoryFromBackend();
            setCategoryGroups(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadBlueprintsByCategory();
    }, [loadBlueprintsByCategory]);

    // Search functionality
    const handleSearch = useCallback(async (query: string) => {
        if (!query.trim()) {
            setSearchResults([]);
            setSearched(false);
            return;
        }

        setIsSearching(true);
        try {
            const results = await searchBlueprintsFromBackend(query);
            setSearchResults(results);
            setSearched(true);
        } finally {
            setIsSearching(false);
        }
    }, []);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            handleSearch(searchTerm);
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [searchTerm, handleSearch]);

    const onSubmit = useCallback(() => {
        handleSearch(searchTerm);
    }, [handleSearch, searchTerm]);

    useEffect(() => {
        opacity.value = withTiming(focused ? 0.05 : 1);
    }, [focused, opacity]);

    // Refresh functionality
    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await loadBlueprintsByCategory();
            // Clear search results when refreshing
            setSearchResults([]);
            setSearched(false);
            setSearchTerm("");
        } catch (error) {
            setError(error.message);
        } finally {
            setRefreshing(false);
        }
    }, [loadBlueprintsByCategory]);

    // Memoized render functions for performance
    const renderBlueprint = useCallback(({ item }: { item: BlueprintDocument }) => (
        <BlueprintCard {...item} />
    ), []);

    const renderBlueprintLarge = useCallback(({ item }: { item: BlueprintDocument }) => (
        <View style={{ marginBottom: 16 }}>
            <BlueprintCard {...item} large={true} />
        </View>
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

    // Loading state
    if (loading) {
        return (
            <ThemedView style={styles.centerContainer}>
                <ThemedText>Loading blueprints...</ThemedText>
            </ThemedView>
        );
    }

    // Error state
    if (error) {
        return (
            <ThemedView style={styles.centerContainer}>
                <ThemedText>Error: {error}</ThemedText>
            </ThemedView>
        );
    }

    // Mock contacts data
    const contacts = [
        { id: "1", name: "Abhik Ray", icon: Icons.luffy, handle: "beak", following: true },
        { id: "2", name: "Abhik Ray", icon: Icons.luffy, handle: "beak", following: false },
        { id: "3", name: "Abhik Ray", icon: Icons.luffy, handle: "beak", following: true },
        { id: "4", name: "Abhik Ray", icon: Icons.luffy, handle: "beak", following: false },
    ];

    return (
        <ThemedView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <View style={styles.searchContainer}>
                <SearchBox
                    value={searchTerm}
                    placeholder={"Search for your friends!"}
                    onChangeText={setSearchTerm}
                    onSubmit={onSubmit}
                    recent={true}
                    name={"search-page"}
                    setFocused={setFocused}
                />
            </View>

            <ScrollView
                style={styles.scrollView}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={ThemedColor.text}
                        colors={[ThemedColor.text]}
                    />
                }>
                <Pressable style={styles.contentContainer} onPress={() => Keyboard.dismiss()}>
                    {!searched ? (
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
                    ) : (
                        <Animated.View style={[focusStyle]} exiting={FadeOut}>
                            <ThemedText type="subtitle" style={styles.searchResultsHeader}>
                                {isSearching ? "Searching..." : "Results"}
                            </ThemedText>

                            {isSearching ? (
                                <View style={styles.searchingContainer}>
                                    <ThemedText>Searching blueprints...</ThemedText>
                                </View>
                            ) : (
                                <View style={styles.searchResultsContainer}>
                                    {searchResults.length > 0 ? (
                                        searchResults.map((blueprint) => (
                                            <View key={blueprint.id} style={styles.searchResultItem}>
                                                <BlueprintCard {...blueprint} large={true} />
                                            </View>
                                        ))
                                    ) : (
                                        <View style={styles.noResultsContainer}>
                                            <ThemedText style={styles.noResultsText}>
                                                No blueprints found for "{searchTerm}"
                                            </ThemedText>
                                        </View>
                                    )}
                                </View>
                            )}
                        </Animated.View>
                    )}
                </Pressable>
            </ScrollView>
        </ThemedView>
    );
};

export default Search;

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    centerContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    searchContainer: {
        paddingHorizontal: 16,
    },
    scrollView: {
        paddingVertical: Dimensions.get("screen").height * 0.03,
    },
    contentContainer: {
        gap: 16,
    },
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
    },
    noResultsContainer: {
        padding: 20,
        alignItems: "center",
    },
    noResultsText: {
        textAlign: "center",
        opacity: 0.7,
    },
});

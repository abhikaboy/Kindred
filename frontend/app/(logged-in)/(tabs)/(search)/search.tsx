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
import React, { useEffect } from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { SearchBox } from "@/components/SearchBox";
import ContactCard from "@/components/cards/ContactCard";
import { Icons } from "@/constants/Icons";
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useThemeColor } from "@/hooks/useThemeColor";
import BlueprintCard from "@/components/cards/BlueprintCard";
import { getBlueprintsToBackend, searchBlueprintsFromBackend } from "@/api/blueprint";
import type { components } from "@/api/generated/types";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type BlueprintDocument = components["schemas"]["BlueprintDocument"];
type Props = {};

const Search = (props: Props) => {
    const [blueprints, setBlueprints] = React.useState<BlueprintDocument[]>([]);
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

    useEffect(() => {
        const loadBlueprints = async () => {
            setLoading(true);
            try {
                const data = await getBlueprintsToBackend();
                setBlueprints(data);
            } finally {
                setLoading(false);
            }
        };

        loadBlueprints();
    }, []);

    const handleSearch = async (query: string) => {
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
    };

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            handleSearch(searchTerm);
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [searchTerm]);

    const onSubmit = () => {
        handleSearch(searchTerm);
    };

    useEffect(() => {
        opacity.value = withTiming(focused ? 0.05 : 1);
    }, [focused]);

    const onRefresh = React.useCallback(async () => {
        setRefreshing(true);
        try {
            const data = await getBlueprintsToBackend();
            setBlueprints(data);
            // Clear search results when refreshing
            setSearchResults([]);
            setSearched(false);
            setSearchTerm("");
        } catch (error) {
            setError(error.message);
        } finally {
            setRefreshing(false);
        }
    }, []);

    type Blueprint = {
        id: string;
        previewImage: string;
        userImage: string;
        workspaceName: string;
        username: string;
        name: string;
        time: string;
        subscriberCount: number;
        description: string;
        tags: string[];
    };

    const renderBlueprint = ({ item }: { item: BlueprintDocument }) => (
        <BlueprintCard
            previewImage={item.banner}
            workspaceName={item.name}
            username={item.owner?.handle || ""}
            name={item.owner?.display_name || ""}
            time={new Date(item.timestamp).toLocaleDateString()}
            subscriberCount={item.subscribersCount}
            description={item.description}
            tags={item.tags}
            id={item.id}
            userImage={item.owner?.profile_picture || ""}
            subscribers={item.subscribers}
        />
    );

    if (loading) {
        return (
            <ThemedView style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                <ThemedText>Loading blueprints...</ThemedText>
            </ThemedView>
        );
    }

    if (error) {
        return (
            <ThemedView style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                <ThemedText>Error: {error}</ThemedText>
            </ThemedView>
        );
    }

    const contacts = [
        { id: "1", name: "Abhik Ray", icon: Icons.luffy, handle: "beak", following: true },
        { id: "2", name: "Abhik Ray", icon: Icons.luffy, handle: "beak", following: false },
        { id: "3", name: "Abhik Ray", icon: Icons.luffy, handle: "beak", following: true },
        { id: "4", name: "Abhik Ray", icon: Icons.luffy, handle: "beak", following: false },
    ];

    const renderContacts = ({ item }) => (
        <ContactCard name={item.name} icon={item.icon} handle={item.handle} following={item.following} />
    );

    return (
        <ThemedView
            style={{
                paddingTop: insets.top,
                paddingBottom: insets.bottom,
            }}>
            <View style={{ paddingHorizontal: 16 }}>
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
                style={{ paddingVertical: Dimensions.get("screen").height * 0.03 }}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={ThemedColor.text}
                        colors={[ThemedColor.text]}
                    />
                }>
                <Pressable style={{ gap: 16 }} onPress={() => Keyboard.dismiss()}>
                    <FlatList
                        data={blueprints}
                        renderItem={renderBlueprint}
                        keyExtractor={(item) => item.id}
                        horizontal={true}
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: 16, gap: 20 }}
                        ItemSeparatorComponent={() => <View style={{ width: 4 }} />}
                    />
                    {!searched && (
                        <Animated.View style={focusStyle} entering={FadeIn} exiting={FadeOut}>
                            <ThemedText type="subtitle" style={{ marginTop: 32, paddingHorizontal: 16 }}>
                                Suggested For You
                            </ThemedText>
                            <FlatList
                                data={contacts}
                                renderItem={renderContacts}
                                keyExtractor={(item) => item.id}
                                horizontal={true}
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ gap: 16, marginTop: 16, paddingHorizontal: 16 }}
                            />
                        </Animated.View>
                    )}
                    {searched && (
                        <Animated.View style={[focusStyle]} exiting={FadeOut}>
                            <ThemedText type="subtitle" style={{ paddingHorizontal: 16 }}>
                                {isSearching ? "Searching..." : "Results"}
                            </ThemedText>

                            {isSearching ? (
                                <View style={{ padding: 20, alignItems: "center" }}>
                                    <ThemedText>Searching blueprints...</ThemedText>
                                </View>
                            ) : (
                                <ScrollView style={{ marginTop: 20, minHeight: "100%" }}>
                                    <View style={{ paddingHorizontal: 16 }}>
                                        {searchResults.length > 0 ? (
                                            searchResults.map((blueprint) => (
                                                <View key={blueprint.id} style={{ marginBottom: 16 }}>
                                                    <BlueprintCard
                                                        previewImage={blueprint.banner}
                                                        workspaceName={blueprint.name}
                                                        username={blueprint.owner?.handle || ""}
                                                        name={blueprint.owner?.display_name || ""}
                                                        time={new Date(blueprint.timestamp).toLocaleDateString()}
                                                        subscriberCount={blueprint.subscribersCount}
                                                        description={blueprint.description}
                                                        tags={blueprint.tags}
                                                        id={blueprint.id}
                                                        userImage={blueprint.owner?.profile_picture || ""}
                                                        subscribers={blueprint.subscribers}
                                                        large={true}
                                                    />
                                                </View>
                                            ))
                                        ) : (
                                            <View style={{ padding: 20, alignItems: "center" }}>
                                                <ThemedText style={{ textAlign: "center", opacity: 0.7 }}>
                                                    No blueprints found for "{searchTerm}"
                                                </ThemedText>
                                            </View>
                                        )}
                                    </View>
                                </ScrollView>
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
    workspaceGrid: {
        flexDirection: "row",
        gap: 20,
    },
});

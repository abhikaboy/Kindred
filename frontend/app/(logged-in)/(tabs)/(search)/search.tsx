import {
    StyleSheet,
    ScrollView,
    View,
    Pressable,
    Keyboard,
    RefreshControl,
    useColorScheme,
    InteractionManager,
} from "react-native";
import { useGuestAccountWall } from "@/hooks/useGuestAccountWall";
import React, { useEffect, useCallback, useMemo, useRef, useReducer, useState } from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { SearchBox, AutocompleteSuggestion } from "@/components/SearchBox";
import ReferralCard from "@/components/profile/ReferralCard";
import { getFriendsAPI } from "@/api/connection";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useThemeColor } from "@/hooks/useThemeColor";
import {
    getBlueprintsByCategoryFromBackend,
    searchBlueprintsFromBackend,
    autocompleteBlueprintsFromBackend,
} from "@/api/blueprint";
import { searchProfiles, autocompleteProfiles, getSuggestedUsers } from "@/api/profile";
import type { components } from "@/api/generated/types";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SearchResults } from "@/components/search/SearchResults";
import { ExplorePage } from "@/components/search/ExplorePage";
import { useRouter } from "expo-router";
import { useRecentSearch, RecentSearchItem } from "@/hooks/useRecentSearch";
import { FollowRequestsSection } from "@/components/profile/FollowRequestsSection";
import { useQuery } from "@tanstack/react-query";
import { useContactSync } from "@/hooks/useContactSync";
import { ContactsFromPhone } from "@/components/search/ContactsFromPhone";
import { SuggestedUsers } from "@/components/search/SuggestedUsers";
import BetterTogetherCard from "@/components/cards/BetterTogetherCard";
import { LinearGradient } from "expo-linear-gradient";
import { getGradient } from "@/constants/Colors";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { UsersThree, SquaresFour } from "phosphor-react-native";
import { AnimatedTabContent } from "@/components/inputs/AnimatedTabs";
import CustomAlert from "@/components/modals/CustomAlert";
import ContactConsentModal from "@/components/modals/ContactConsentModal";
import FriendsList from "@/components/search/FriendsList";
import { useAnalytics } from "@/hooks/useAnalytics";
import { AnalyticsEvents } from "@/utils/analytics";
import GlowBackground, { GlowBlob } from "@/components/ui/GlowBackground";

// centered arrangement for search/friends; strengths match the workspace glow
const SEARCH_GLOW: GlowBlob[] = [
    { color: "#854DFF", opacity: { dark: 0.08, light: 0.065 }, cx: 50, cy: 38, rx: 42, ry: 22, falloff: "60%" },
    { color: "#4D9EFF", opacity: { dark: 0.06, light: 0.08 }, cx: 50, cy: 88, rx: 36, ry: 15 },
];

type BlueprintDocument = components["schemas"]["BlueprintDocument"];
type BlueprintCategoryGroup = components["schemas"]["BlueprintCategoryGroup"];
type ProfileDocument = components["schemas"]["ProfileDocument"];

type Props = {};

type SearchState = {
    mode: "categories" | "searching" | "results" | "no-results";
    searchTerm: string;
    searchResults: BlueprintDocument[];
    userResults: ProfileDocument[];
    error: string | null;
};

type SearchAction =
    | { type: "SET_SEARCH_TERM"; payload: string }
    | { type: "START_SEARCH" }
    | { type: "SEARCH_SUCCESS"; payload: { blueprints: BlueprintDocument[]; users: ProfileDocument[] } }
    | { type: "SEARCH_ERROR"; payload: string }
    | { type: "CLEAR_SEARCH" }
    | { type: "REFRESH" };

const searchReducer = (state: SearchState, action: SearchAction): SearchState => {
    switch (action.type) {
        case "SET_SEARCH_TERM":
            return {
                ...state,
                searchTerm: action.payload,
                // Only change to categories mode if search term is completely empty
                // Otherwise maintain current mode until user submits
                mode: action.payload.trim() === "" ? "categories" : state.mode,
            };
        case "START_SEARCH":
            return { ...state, mode: "searching" };
        case "SEARCH_SUCCESS":
            const hasResults = action.payload.blueprints.length > 0 || action.payload.users.length > 0;
            return {
                ...state,
                searchResults: action.payload.blueprints,
                userResults: action.payload.users,
                mode: hasResults ? "results" : "no-results",
            };
        case "SEARCH_ERROR":
            return { ...state, mode: "no-results", error: action.payload };
        case "CLEAR_SEARCH":
            return {
                ...state,
                searchTerm: "",
                searchResults: [],
                userResults: [],
                mode: "categories",
                error: null,
            };
        case "REFRESH":
            return {
                ...state,
                searchResults: [],
                userResults: [],
                mode: "categories",
                error: null,
            };
        default:
            return state;
    }
};

const Search = (props: Props) => {
    useGuestAccountWall("search");
    const [categoryGroups, setCategoryGroups] = React.useState<BlueprintCategoryGroup[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [activeTab, setActiveTab] = React.useState(1); // Default to Friends (index 1)
    const [shouldRenderBlueprints, setShouldRenderBlueprints] = useState(false);
    const [headerHeight, setHeaderHeight] = useState(0);
    const ThemedColor = useThemeColor();
    const styles = useMemo(() => stylesheet(ThemedColor), [ThemedColor]);
    const { capture } = useAnalytics();
    const contactSync = useContactSync();
    const { matchedContacts, isLoadingMatchedContacts } = contactSync;

    // TanStack Query for fetching suggested users
    const { data: suggestedUsers = [], isLoading: isLoadingSuggestedUsers } = useQuery({
        queryKey: ["suggestedUsers"],
        queryFn: getSuggestedUsers,
        staleTime: 1000 * 60 * 5, // 5 minutes
        refetchOnWindowFocus: false,
    });

    // Shares FriendsList's cache; gates the getting-started card to friendless users.
    const { data: friendsForGate } = useQuery({
        queryKey: ["friends"],
        queryFn: getFriendsAPI,
        staleTime: 1000 * 60 * 2,
    });
    const hasFriends = (friendsForGate ?? []).length > 0;

    const skipAutocompleteRef = useRef(false);

    const [state, dispatch] = useReducer(searchReducer, {
        mode: "categories",
        searchTerm: "",
        searchResults: [],
        userResults: [],
        error: null,
    });

    const { searchTerm, searchResults, userResults, mode, error: searchError } = state;

    const contactSuggestions = useMemo<AutocompleteSuggestion[]>(() =>
        matchedContacts.slice(0, 6).map(c => ({
            id: c.user._id,
            display_name: c.user.display_name,
            handle: c.user.handle,
            profile_picture: c.user.profile_picture,
            type: "user" as const,
        })),
        [matchedContacts],
    );

    const [focused, setFocused] = React.useState(false);
    const [autocompleteSuggestions, setAutocompleteSuggestions] = React.useState<AutocompleteSuggestion[]>([]);
    const [showAutocomplete, setShowAutocomplete] = React.useState(false);
    const hasContactDefaults = contactSuggestions.length > 0;
    const isTyping = searchTerm.trim().length > 0;
    const effectiveSuggestions = isTyping ? autocompleteSuggestions : contactSuggestions;
    const effectiveShowAutocomplete = isTyping ? showAutocomplete : hasContactDefaults;

    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isSelectingFromRecent = useRef(false);
    const router = useRouter();
    const { appendSearch } = useRecentSearch("search-page");

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

    // Autocomplete function with debouncing - only fetch, don't update main results
    const handleAutocomplete = useCallback(async (query: string) => {
        console.log("🔍 handleAutocomplete called with query:", query);
        if (!query.trim() || query.trim().length < 2) {
            console.log("🔍 Query too short, clearing autocomplete");
            setAutocompleteSuggestions([]);
            setShowAutocomplete(false);
            return;
        }

        try {
            console.log("🔍 Calling autocompleteProfiles API with query:", query);
            // Prioritize users for autocomplete
            const userResults = await autocompleteProfiles(query);
            console.log("🔍 API returned userResults:", userResults);

            // Convert to autocomplete suggestions format
            const suggestions: AutocompleteSuggestion[] = userResults.map((user) => ({
                id: user.id,
                display_name: user.display_name,
                handle: user.handle,
                profile_picture: user.profile_picture,
                type: "user" as const,
            }));

            console.log("🔍 Autocomplete suggestions:", suggestions);
            setAutocompleteSuggestions(suggestions);
            setShowAutocomplete(true);
            console.log("🔍 showAutocomplete set to true, suggestions count:", suggestions.length);
        } catch (error) {
            console.error("Autocomplete error:", error);
            setAutocompleteSuggestions([]);
        }
    }, []);

    // Full search function for submit
    // In your Search component (search.tsx), update handleSearch:
    const handleSearch = useCallback(async (query: string) => {
        console.log("🔎 handleSearch called with query:", query);

        if (!query.trim()) {
            dispatch({ type: "CLEAR_SEARCH" });
            return;
        }

        // Clear autocomplete before searching
        setShowAutocomplete(false);
        setAutocompleteSuggestions([]);

        dispatch({ type: "START_SEARCH" });

        try {
            const [blueprintResults, userResults] = await Promise.all([
                searchBlueprintsFromBackend(query),
                autocompleteProfiles(query), // Using autocomplete which works
            ]);

            console.log("🔎 Search Results:");
            console.log("  - Blueprints found:", blueprintResults?.length || 0);
            console.log("  - Users found:", userResults?.length || 0);

            dispatch({
                type: "SEARCH_SUCCESS",
                payload: {
                    blueprints: blueprintResults || [],
                    users: userResults || [],
                },
            });
            capture(AnalyticsEvents.SEARCH_PERFORMED, {
                query_length: query.trim().length,
                result_count: (blueprintResults?.length ?? 0) + (userResults?.length ?? 0),
            });
        } catch (error) {
            console.error("🔎 Search error:", error);
            dispatch({ type: "SEARCH_ERROR", payload: error.message });
        }
    }, []);

    const onSubmit = useCallback(() => {
        // Clear debounce timer
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        // IMPORTANT: Clear autocomplete completely
        setShowAutocomplete(false);
        setAutocompleteSuggestions([]);

        // Execute the search
        handleSearch(searchTerm);
    }, [handleSearch, searchTerm]);

    useEffect(() => {
        opacity.value = withTiming(focused ? 0.3 : 1);
    }, [focused, opacity]);

    // Refresh functionality
    const onRefresh = useCallback(async () => {
        dispatch({ type: "REFRESH" });
        try {
            await loadBlueprintsByCategory();
            dispatch({ type: "CLEAR_SEARCH" });
        } catch (error) {
            setError(error.message);
        }
    }, [loadBlueprintsByCategory]);

    // Memoize the onChangeText callback with debounced autocomplete
    const handleSearchTermChange = useCallback(
        (text: string) => {
            dispatch({ type: "SET_SEARCH_TERM", payload: text });

            // Clear existing timer
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }

            // Don't trigger autocomplete if we're selecting from recents
            if (isSelectingFromRecent.current) {
                isSelectingFromRecent.current = false;
                setAutocompleteSuggestions([]);
                setShowAutocomplete(false);
                return;
            }

            // Set new timer for autocomplete (300ms delay)
            if (text.trim().length >= 2) {
                debounceTimerRef.current = setTimeout(() => {
                    handleAutocomplete(text);
                }, 300);
            } else {
                setAutocompleteSuggestions([]);
                setShowAutocomplete(false);
                if (text.trim().length === 0) {
                    dispatch({ type: "CLEAR_SEARCH" });
                }
            }
        },
        [handleAutocomplete]
    );

    // Handle selecting an autocomplete suggestion
    const handleSelectSuggestion = useCallback(
        (suggestion: AutocompleteSuggestion) => {
            setShowAutocomplete(false);
            setAutocompleteSuggestions([]);

            // Save to recent searches with full data
            const recentItem: RecentSearchItem = {
                id: suggestion.id,
                type: suggestion.type,
                display_name: suggestion.display_name,
                handle: suggestion.handle,
                name: suggestion.name,
                profile_picture: suggestion.profile_picture,
                banner: suggestion.banner,
            };
            appendSearch(recentItem);
            capture(AnalyticsEvents.SEARCH_RESULT_TAPPED, {
                result_type: suggestion.type,
            });

            if (suggestion.type === "user") {
                // Navigate to user profile
                router.push(`/account/${suggestion.id}`);
            } else {
                // Navigate to blueprint
                router.push(`/blueprint/${suggestion.id}`);
            }
        },
        [router, appendSearch]
    );

    // Memoize the onSubmit callback
    const handleSubmit = useCallback(
        (searchText?: string) => {
            const textToSearch = searchText || searchTerm;
            console.log("🔎 handleSubmit called with:", textToSearch);

            // If we have a searchText parameter, we're selecting from recents
            if (searchText) {
                isSelectingFromRecent.current = true;
                dispatch({ type: "SET_SEARCH_TERM", payload: searchText });
            }

            // Clear any pending autocomplete
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }

            // Clear autocomplete suggestions
            setShowAutocomplete(false);
            setAutocompleteSuggestions([]);

            // Only search if we have text
            if (textToSearch.trim()) {
                console.log("🔎 Calling handleSearch from handleSubmit with:", textToSearch);
                setFocused(false);
                handleSearch(textToSearch);
            } else {
                console.log("🔎 No text to search");
            }
        },
        [handleSearch, searchTerm]
    );
    // Memoize the setFocused callback
    const handleSetFocused = useCallback((focused: boolean) => {
        setFocused(focused);
    }, []);

    // Cleanup debounce timer on unmount
    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, []);

    const colorScheme = useColorScheme();
    const gradientColors = getGradient(colorScheme ?? "light") as [string, string, ...string[]];

    // Error state
    if (error) {
        return (
            <ThemedView style={styles.centerContainer}>
                <ThemedText>Error: {error}</ThemedText>
            </ThemedView>
        );
    }

    // Handle toggle press with deferred rendering
    const handleTogglePress = useCallback((option: string) => {
        const newTab = option === "Blueprints" ? 0 : 1;
        setActiveTab(newTab);

        // Defer Blueprints tab rendering until after interaction completes
        if (newTab === 0) {
            const handle = InteractionManager.runAfterInteractions(() => {
                setShouldRenderBlueprints(true);
            });
            return () => handle.cancel();
        }
    }, []);

    // Ensure Blueprints render when initially selected
    useEffect(() => {
        if (activeTab === 0) {
            const handle = InteractionManager.runAfterInteractions(() => {
                setShouldRenderBlueprints(true);
            });
            return () => handle.cancel();
        }
    }, [activeTab]);

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom }]}>
            <ThemedView style={{ flex: 1 }}>
                <GlowBackground blobs={SEARCH_GLOW} />
                {/* Gradient fade overlay behind header, extending into scroll area */}
                {headerHeight > 0 && (
                    <LinearGradient
                        colors={gradientColors}
                        locations={[0, 0.25, 0.45, 0.6, 0.75, 1]}
                        pointerEvents="none"
                        style={{
                            position: "absolute",
                            left: 0,
                            right: 0,
                            top: 0,
                            height: headerHeight + 20,
                            zIndex: 1,
                        }}
                    />
                )}

                {/* Header - in normal flex flow */}
                <View
                    style={[styles.searchContainer, { zIndex: focused ? 10 : 2, paddingTop: insets.top }]}
                    onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}>
                    <SearchBox
                        value={searchTerm}
                        placeholder={"Search for a user or blueprint!"}
                        onChangeText={handleSearchTermChange}
                        onSubmit={handleSubmit}
                        recent={!showAutocomplete && !hasContactDefaults && mode === "categories"}
                        name={"search-page"}
                        setFocused={handleSetFocused}
                        autocompleteSuggestions={effectiveSuggestions}
                        onSelectSuggestion={handleSelectSuggestion}
                        showAutocomplete={effectiveShowAutocomplete && mode === "categories"}
                        suggestionsHeader={hasContactDefaults && !searchTerm.trim() ? "Friends on Kindred" : undefined}
                    />
                    <SegmentedControl
                        options={["Blueprints", "Friends"]}
                        selectedOption={activeTab === 0 ? "Blueprints" : "Friends"}
                        onOptionPress={handleTogglePress}
                        accent
                        icons={{
                            Friends: (color, focused) => (
                                <UsersThree size={20} color={color} weight={focused ? "fill" : "regular"} />
                            ),
                            Blueprints: (color, focused) => (
                                <SquaresFour size={20} color={color} weight={focused ? "fill" : "regular"} />
                            ),
                        }}
                    />
                </View>

                {/* Scrollable content - fills remaining space */}
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    scrollEventThrottle={16}
                    removeClippedSubviews={true}
                    refreshControl={
                        <RefreshControl
                            refreshing={false}
                            onRefresh={onRefresh}
                            tintColor={ThemedColor.text}
                            colors={[ThemedColor.text]}
                        />
                    }>
                    {mode === "categories" && (
                        <AnimatedTabContent activeTab={activeTab} setActiveTab={setActiveTab}>
                            <View>
                                {shouldRenderBlueprints && (
                                    <Pressable style={styles.contentContainer} onPress={() => Keyboard.dismiss()}>
                                        <ExplorePage categoryGroups={categoryGroups} focusStyle={focusStyle} loading={loading} />
                                    </Pressable>
                                )}
                            </View>
                            <View style={{ paddingBottom: 120 }}>
                                <FollowRequestsSection styles={styles} />
                                <FriendsList />
                                {!isLoadingMatchedContacts && matchedContacts.length > 0 && (
                                    <ContactsFromPhone contacts={matchedContacts} />
                                )}
                                {!isLoadingSuggestedUsers && suggestedUsers.length > 0 && (
                                    <SuggestedUsers
                                        users={suggestedUsers}
                                        onSeeMore={() => router.push("/(logged-in)/(tabs)/(search)/discover")}
                                    />
                                )}
                                <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
                                    <ReferralCard />
                                </View>
                                {!hasFriends && (
                                    <BetterTogetherCard
                                        onSyncContacts={contactSync.sync}
                                        isLoadingContacts={contactSync.isSyncing}
                                        isFindingFriends={false}
                                    />
                                )}
                            </View>
                        </AnimatedTabContent>
                    )}
                    {mode !== "categories" && (
                        <Pressable style={styles.contentContainer} onPress={() => Keyboard.dismiss()}>
                            <SearchResults
                                mode={mode}
                                searchResults={searchResults}
                                userResults={userResults}
                                searchTerm={searchTerm}
                                focusStyle={focusStyle}
                                activeTab={activeTab}
                                setActiveTab={setActiveTab}
                                showTabs={false}
                            />
                        </Pressable>
                    )}
                </ScrollView>

                {focused && (
                    <Pressable
                        style={[
                            StyleSheet.absoluteFillObject,
                            { zIndex: 5, backgroundColor: ThemedColor.background, opacity: 0.95 },
                        ]}
                        onPress={() => {
                            Keyboard.dismiss();
                            setFocused(false);
                        }}
                    />
                )}
            </ThemedView>
            <CustomAlert
                visible={contactSync.alert.visible}
                setVisible={contactSync.setAlertVisible}
                title={contactSync.alert.title}
                message={contactSync.alert.message}
                buttons={contactSync.alert.buttons}
            />
            <ContactConsentModal
                visible={contactSync.consentVisible}
                onAccept={contactSync.acceptConsent}
                onDecline={contactSync.declineConsent}
            />
        </View>
    );
};
export default Search;

const stylesheet = (ThemedColor: any) => {
    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: "transparent",
        },
        centerContainer: {
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
        },
        searchContainer: {
            paddingHorizontal: 16,
            paddingVertical: 8,
            paddingBottom: 16,
        },
        betterTogetherContainer: {
            paddingHorizontal: 16,
        },
        scrollView: {
            flex: 1,
        },
        scrollContent: {
            paddingTop: 8,
        },
        contentContainer: {
            gap: 16,
        },
        friendRequestsSection: {
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 8,
            gap: 8,
        },
        friendRequestsHeader: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
        },
        requestItem: {
            marginVertical: 6,
        },
    });
};

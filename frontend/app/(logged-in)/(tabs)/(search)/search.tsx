import {
    Dimensions,
    StyleSheet,
    ScrollView,
    View,
    Pressable,
    Keyboard,
    RefreshControl,
} from "react-native";
import React, { useEffect, useCallback, useMemo, useRef, useReducer } from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { SearchBox, AutocompleteSuggestion } from "@/components/SearchBox";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useThemeColor } from "@/hooks/useThemeColor";
import { getBlueprintsByCategoryFromBackend, searchBlueprintsFromBackend, autocompleteBlueprintsFromBackend } from "@/api/blueprint";
import { searchProfiles, autocompleteProfiles } from "@/api/profile";
import type { components } from "@/api/generated/types";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SearchResults } from "@/components/search/SearchResults";
import { ExplorePage } from "@/components/search/ExplorePage";
import { useRouter } from "expo-router";
import { useRecentSearch, RecentSearchItem } from "@/hooks/useRecentSearch";
import { FollowRequestsSection } from "@/components/profile/FollowRequestsSection";

type BlueprintDocument = components["schemas"]["BlueprintDocument"];
type BlueprintCategoryGroup = components["schemas"]["BlueprintCategoryGroup"];
type ProfileDocument = components["schemas"]["ProfileDocument"];

type Props = {};

type SearchState = {
    mode: 'categories' | 'searching' | 'results' | 'no-results';
    searchTerm: string;
    searchResults: BlueprintDocument[];
    userResults: ProfileDocument[];
    error: string | null;
};

type SearchAction = 
    | { type: 'SET_SEARCH_TERM'; payload: string }
    | { type: 'START_SEARCH' }
    | { type: 'SEARCH_SUCCESS'; payload: { blueprints: BlueprintDocument[]; users: ProfileDocument[] } }
    | { type: 'SEARCH_ERROR'; payload: string }
    | { type: 'CLEAR_SEARCH' }
    | { type: 'REFRESH' };

const searchReducer = (state: SearchState, action: SearchAction): SearchState => {
    switch (action.type) {
        case 'SET_SEARCH_TERM':
            return {
                ...state,
                searchTerm: action.payload,
                // Only change to categories mode if search term is completely empty
                // Otherwise maintain current mode until user submits
                mode: action.payload.trim() === '' ? 'categories' : state.mode
            };
        case 'START_SEARCH':
            return { ...state, mode: 'searching' };
        case 'SEARCH_SUCCESS':
            const hasResults = action.payload.blueprints.length > 0 || action.payload.users.length > 0;
            return {
                ...state,
                searchResults: action.payload.blueprints,
                userResults: action.payload.users,
                mode: hasResults ? 'results' : 'no-results'
            };
        case 'SEARCH_ERROR':
            return { ...state, mode: 'no-results', error: action.payload };
        case 'CLEAR_SEARCH':
            return {
                ...state,
                searchTerm: '',
                searchResults: [],
                userResults: [],
                mode: 'categories',
                error: null
            };
        case 'REFRESH':
            return {
                ...state,
                searchResults: [],
                userResults: [],
                mode: 'categories',
                error: null
            };
        default:
            return state;
    }
};

const Search = (props: Props) => {
    const [categoryGroups, setCategoryGroups] = React.useState<BlueprintCategoryGroup[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [activeTab, setActiveTab] = React.useState(1); // Default to Users tab (index 1)
    const ThemedColor = useThemeColor();
    const styles = useMemo(() => stylesheet(ThemedColor), [ThemedColor]);

    const [state, dispatch] = useReducer(searchReducer, {
        mode: 'categories',
        searchTerm: '',
        searchResults: [],
        userResults: [],
        error: null
    });

    const { searchTerm, searchResults, userResults, mode, error: searchError } = state;

    const [focused, setFocused] = React.useState(false);
    const [autocompleteSuggestions, setAutocompleteSuggestions] = React.useState<AutocompleteSuggestion[]>([]);
    const [showAutocomplete, setShowAutocomplete] = React.useState(false);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
        if (!query.trim() || query.trim().length < 2) {
            setAutocompleteSuggestions([]);
            setShowAutocomplete(false);
            return;
        }

        try {
            // Prioritize users for autocomplete
            const userResults = await autocompleteProfiles(query);
            
            // Convert to autocomplete suggestions format
            const suggestions: AutocompleteSuggestion[] = userResults.map(user => ({
                id: user.id,
                display_name: user.display_name,
                handle: user.handle,
                profile_picture: user.profile_picture,
                type: 'user' as const
            }));

            setAutocompleteSuggestions(suggestions);
            setShowAutocomplete(true);
        } catch (error) {
            console.error('Autocomplete error:', error);
            setAutocompleteSuggestions([]);
        }
    }, []);

    // Full search function for submit
    const handleSearch = useCallback(async (query: string) => {
        if (!query.trim()) {
            dispatch({ type: 'CLEAR_SEARCH' });
            return;
        }

        dispatch({ type: 'START_SEARCH' });
        try {
            // Search for both blueprints and users in parallel
            const [blueprintResults, userResults] = await Promise.all([
                searchBlueprintsFromBackend(query),
                searchProfiles(query)
            ]);

            dispatch({ 
                type: 'SEARCH_SUCCESS', 
                payload: { 
                    blueprints: blueprintResults, 
                    users: userResults 
                } 
            });
        } catch (error) {
            dispatch({ type: 'SEARCH_ERROR', payload: error.message });
        }
    }, []);

    const onSubmit = useCallback(() => {
        // Clear debounce timer and autocomplete on submit
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
        setShowAutocomplete(false);
        setAutocompleteSuggestions([]);
        handleSearch(searchTerm);
    }, [handleSearch, searchTerm]);

    useEffect(() => {
        opacity.value = withTiming(focused ? 0.05 : 1);
    }, [focused, opacity]);

    // Refresh functionality
    const onRefresh = useCallback(async () => {
        dispatch({ type: 'REFRESH' });
        try {
            await loadBlueprintsByCategory();
            dispatch({ type: 'CLEAR_SEARCH' });
        } catch (error) {
            setError(error.message);
        }
    }, [loadBlueprintsByCategory]);

    // Memoize the onChangeText callback with debounced autocomplete
    const handleSearchTermChange = useCallback((text: string) => {
        dispatch({ type: 'SET_SEARCH_TERM', payload: text });
        
        // Clear existing timer
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
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
                dispatch({ type: 'CLEAR_SEARCH' });
            }
        }
    }, [handleAutocomplete]);

    // Handle selecting an autocomplete suggestion
    const handleSelectSuggestion = useCallback((suggestion: AutocompleteSuggestion) => {
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
        
        if (suggestion.type === 'user') {
            // Navigate to user profile
            router.push(`/account/${suggestion.id}`);
        } else {
            // Navigate to blueprint
            router.push(`/blueprint/${suggestion.id}`);
        }
    }, [router, appendSearch]);

    // Memoize the onSubmit callback
    const handleSubmit = useCallback(() => {
        handleSearch(searchTerm);
    }, [handleSearch, searchTerm]);

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

    // Error state
    if (error) {
        return (
            <ThemedView style={styles.centerContainer}>
                <ThemedText>Error: {error}</ThemedText>
            </ThemedView>
        );
    }

    return (
        <ThemedView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <View style={styles.searchContainer}>
                <SearchBox
                    value={searchTerm}
                    placeholder={"Search for a user or blueprint!"}
                    onChangeText={handleSearchTermChange}
                    onSubmit={handleSubmit}
                    recent={!showAutocomplete}
                    name={"search-page"}
                    setFocused={handleSetFocused}
                    autocompleteSuggestions={autocompleteSuggestions}
                    onSelectSuggestion={handleSelectSuggestion}
                    showAutocomplete={showAutocomplete}
                />
            </View>


            <ScrollView
                style={styles.scrollView}
                refreshControl={
                    <RefreshControl
                    refreshing={false}
                    onRefresh={onRefresh}
                    tintColor={ThemedColor.text}
                    colors={[ThemedColor.text]}
                    />
                }>
                    <FollowRequestsSection styles={styles} />
                <Pressable style={styles.contentContainer} onPress={() => Keyboard.dismiss()}>
                    {mode === 'categories' ? (
                        <ExplorePage 
                            categoryGroups={categoryGroups}
                            focusStyle={focusStyle}
                            loading={loading}
                        />
                    ) : (
                        <SearchResults
                            mode={mode}
                            searchResults={searchResults}
                            userResults={userResults}
                            searchTerm={searchTerm}
                            focusStyle={focusStyle}
                            activeTab={activeTab}
                            setActiveTab={setActiveTab}
                        />
                    )}
                </Pressable>
            </ScrollView>
        </ThemedView>
    );
};

export default Search;

const stylesheet = (ThemedColor: any) => {
    return StyleSheet.create({
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

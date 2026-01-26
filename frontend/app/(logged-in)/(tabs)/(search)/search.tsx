import {
    Dimensions,
    StyleSheet,
    ScrollView,
    View,
    Pressable,
    Keyboard,
    RefreshControl,
    useColorScheme,
    InteractionManager,
} from "react-native";
import React, { useEffect, useCallback, useMemo, useRef, useReducer, useState } from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { SearchBox, AutocompleteSuggestion } from "@/components/SearchBox";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useThemeColor } from "@/hooks/useThemeColor";
import {
    getBlueprintsByCategoryFromBackend,
    searchBlueprintsFromBackend,
    autocompleteBlueprintsFromBackend,
} from "@/api/blueprint";
import { searchProfiles, autocompleteProfiles, findUsersByPhoneNumbers, getSuggestedUsers } from "@/api/profile";
import type { components } from "@/api/generated/types";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SearchResults } from "@/components/search/SearchResults";
import { ExplorePage } from "@/components/search/ExplorePage";
import { useRouter } from "expo-router";
import { useRecentSearch, RecentSearchItem } from "@/hooks/useRecentSearch";
import { FollowRequestsSection } from "@/components/profile/FollowRequestsSection";
import { useContacts } from "@/hooks/useContacts";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMatchedContacts, type MatchedContact } from "@/hooks/useMatchedContacts";
import { ContactsFromPhone } from "@/components/search/ContactsFromPhone";
import { SuggestedUsers } from "@/components/search/SuggestedUsers";
import * as Contacts from "expo-contacts";
import BetterTogetherCard from "@/components/cards/BetterTogetherCard";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { getGradient } from "@/constants/Colors";
import SegmentedControl from "@/components/ui/SegmentedControl";
import CustomAlert, { AlertButton } from "@/components/modals/CustomAlert";
import ContactConsentModal from "@/components/modals/ContactConsentModal";
import { useContactConsent } from "@/hooks/useContactConsent";

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
    const [categoryGroups, setCategoryGroups] = React.useState<BlueprintCategoryGroup[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [activeTab, setActiveTab] = React.useState(1); // Default to Friends (index 1)
    const [shouldRenderBlueprints, setShouldRenderBlueprints] = useState(false);
    const ThemedColor = useThemeColor();
    const styles = useMemo(() => stylesheet(ThemedColor), [ThemedColor]);
    const { getContacts, isLoading: isLoadingContacts } = useContacts();
    const { matchedContacts, addMatchedContacts, isLoading: isLoadingMatchedContacts } = useMatchedContacts();
    const { hasConsent, grantConsent, denyConsent } = useContactConsent();

    // Alert state
    const [alertVisible, setAlertVisible] = React.useState(false);
    const [alertTitle, setAlertTitle] = React.useState("");
    const [alertMessage, setAlertMessage] = React.useState("");
    const [alertButtons, setAlertButtons] = React.useState<AlertButton[]>([]);
    
    // Consent modal state
    const [consentModalVisible, setConsentModalVisible] = React.useState(false);

    // TanStack Query for fetching suggested users
    const { data: suggestedUsers = [], isLoading: isLoadingSuggestedUsers } = useQuery({
        queryKey: ["suggestedUsers"],
        queryFn: getSuggestedUsers,
        staleTime: 1000 * 60 * 5, // 5 minutes
        refetchOnWindowFocus: false,
    });

    // Store contacts map ref to access in mutation callback
    const contactsMapRef = useRef<{ [phoneNumber: string]: string }>({});

    // TanStack Query mutation for finding users by phone numbers
    const findUsersMutation = useMutation({
        mutationFn: findUsersByPhoneNumbers,
        onSuccess: (matchedUsers) => {
            console.log(`Found ${matchedUsers.length} matching users on Kindred:`, matchedUsers);

            if (matchedUsers.length > 0) {
                // Map matched users to MatchedContact format with contact names
                const newMatchedContacts: MatchedContact[] = matchedUsers.map((user) => ({
                    user,
                    contactName: contactsMapRef.current[user.phone] || "Unknown",
                }));

                // Save to AsyncStorage
                addMatchedContacts(newMatchedContacts);

                setAlertTitle("Friends Found!");
                setAlertMessage(`Found ${matchedUsers.length} of your contacts on Kindred! Scroll down to see them.`);
                setAlertButtons([{ text: "OK", style: "default" }]);
                setAlertVisible(true);
            } else {
            }
        },
        onError: (error) => {
            console.error("Error finding users by phone numbers:", error);
            setAlertTitle("Error");
            setAlertMessage("Failed to find contacts. Please try again.");
            setAlertButtons([{ text: "OK", style: "default" }]);
            setAlertVisible(true);
        },
    });
    const skipAutocompleteRef = useRef(false);

    const [state, dispatch] = useReducer(searchReducer, {
        mode: "categories",
        searchTerm: "",
        searchResults: [],
        userResults: [],
        error: null,
    });

    const { searchTerm, searchResults, userResults, mode, error: searchError } = state;

    const [focused, setFocused] = React.useState(false);
    const [autocompleteSuggestions, setAutocompleteSuggestions] = React.useState<AutocompleteSuggestion[]>([]);
    const [showAutocomplete, setShowAutocomplete] = React.useState(false);
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

    // Handle rewards card press
    const handleRewardsCardPress = useCallback(() => {
        router.push("/rewards");
    }, [router]);

    const colorScheme = useColorScheme();
    const gradientColors = getGradient(colorScheme ?? "light") as [string, string, ...string[]];

    // Handle the actual contact syncing after consent is granted
    const performContactSync = useCallback(async () => {
        try {
            const contactsResponse = await getContacts();

            // Handle alert if present
            if (contactsResponse.alert) {
                setAlertTitle(contactsResponse.alert.title);
                setAlertMessage(contactsResponse.alert.message);
                setAlertButtons(contactsResponse.alert.buttons || [{ text: "OK", style: "default" }]);
                setAlertVisible(true);
                return;
            }

            // If no numbers returned, permission was likely denied or no contacts exist
            if (contactsResponse.numbers.length === 0) {
                // The hook already returns alerts for permission issues which we handled above
                // Only show this alert if permission was granted but no numbers found
                const { status } = await Contacts.getPermissionsAsync();
                if (status === "granted") {
                    setAlertTitle("No Phone Numbers Found");
                    setAlertMessage("We couldn't find any phone numbers in your contacts. Make sure your contacts have phone numbers saved.");
                    setAlertButtons([{ text: "OK", style: "default" }]);
                    setAlertVisible(true);
                }
                return;
            }

            console.log("Contacts response:", contactsResponse);
            console.log(`Total phone numbers: ${contactsResponse.numbers.length}`);

            // Store contacts map for use in mutation callback
            contactsMapRef.current = contactsResponse.contactsMap;

            // Use TanStack Query mutation for efficient single-query database lookup
            findUsersMutation.mutate(contactsResponse.numbers);
        } catch (error) {
            console.error("Error getting contacts:", error);
            setAlertTitle("Error");
            setAlertMessage("Failed to access contacts. Please try again.");
            setAlertButtons([{ text: "OK", style: "default" }]);
            setAlertVisible(true);
        }
    }, [getContacts, findUsersMutation]);

    // Handle consent acceptance
    const handleConsentAccept = useCallback(async () => {
        try {
            await grantConsent();
            setConsentModalVisible(false);
            // Proceed with contact sync
            await performContactSync();
        } catch (error) {
            console.error("Error granting consent:", error);
            setAlertTitle("Error");
            setAlertMessage("Failed to save your consent. Please try again.");
            setAlertButtons([{ text: "OK", style: "default" }]);
            setAlertVisible(true);
        }
    }, [grantConsent, performContactSync]);

    // Handle consent decline
    const handleConsentDecline = useCallback(async () => {
        try {
            await denyConsent();
            setConsentModalVisible(false);
            setAlertTitle("Contact Sync Declined");
            setAlertMessage("You can enable contact syncing later from your account settings.");
            setAlertButtons([{ text: "OK", style: "default" }]);
            setAlertVisible(true);
        } catch (error) {
            console.error("Error denying consent:", error);
            setConsentModalVisible(false);
        }
    }, [denyConsent]);

    // Handle contacts import - check consent first
    const handleAddContacts = useCallback(async () => {
        // Check if user has already granted consent
        if (hasConsent === true) {
            // User has already consented, proceed directly
            await performContactSync();
        } else if (hasConsent === false) {
            // User previously declined, show message
            setAlertTitle("Contact Sync Disabled");
            setAlertMessage("You previously declined contact syncing. You can enable it in your account settings.");
            setAlertButtons([{ text: "OK", style: "default" }]);
            setAlertVisible(true);
        } else {
            // User hasn't been asked yet, show consent modal
            setConsentModalVisible(true);
        }
    }, [hasConsent, performContactSync]);

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
        <View style={[styles.container, { paddingTop: 0, paddingBottom: insets.bottom }]}>
            <ThemedView style={{ flex: 1 }}>
                <ScrollView
                    style={[styles.scrollView, { paddingTop: insets.top + 140 }]}
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
                        <>
                            {/* Friends Tab - Keep mounted but hide when not active */}
                            <View 
                                style={{ display: activeTab === 1 ? "flex" : "none", paddingBottom: 120 }}
                                removeClippedSubviews={activeTab !== 1}
                            >
                                <View style={styles.betterTogetherContainer}>
                                    <BetterTogetherCard
                                        onSyncContacts={handleAddContacts}
                                        isLoadingContacts={isLoadingContacts}
                                        isFindingFriends={findUsersMutation.isPending}
                                        onCardPress={handleRewardsCardPress}
                                    />
                                </View>
                                <FollowRequestsSection styles={styles} />
                                {!isLoadingMatchedContacts && matchedContacts.length > 0 && (
                                    <ContactsFromPhone contacts={matchedContacts} />
                                )}
                                {!isLoadingSuggestedUsers && suggestedUsers.length > 0 && (
                                    <SuggestedUsers users={suggestedUsers} />
                                )}
                            </View>

                            {/* Blueprints Tab - Lazy render after interaction completes */}
                            <View 
                                style={{ display: activeTab === 0 ? "flex" : "none" }}
                                removeClippedSubviews={activeTab !== 0}
                            >
                                {shouldRenderBlueprints && (
                                    <Pressable style={styles.contentContainer} onPress={() => Keyboard.dismiss()}>
                                        <ExplorePage categoryGroups={categoryGroups} focusStyle={focusStyle} loading={loading} />
                                    </Pressable>
                                )}
                            </View>
                        </>
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
                        style={StyleSheet.absoluteFillObject}
                        onPress={() => {
                            Keyboard.dismiss();
                            setFocused(false);
                        }}>
                        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
                    </Pressable>
                )}
            </ThemedView>
            <View
                style={[
                    styles.searchContainer,
                    {
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        zIndex: focused ? 10 : 1,
                    },
                ]}>
                <LinearGradient
                    colors={gradientColors}
                    locations={[0, 0.25, 0.45, 0.6, 0.75, 1]}
                    style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        top: 0,
                        height: insets.top + 160,
                    }}
                />

                <View style={{ paddingTop: insets.top }}>
                    <SearchBox
                        value={searchTerm}
                        placeholder={"Search for a user or blueprint!"}
                        onChangeText={handleSearchTermChange}
                        onSubmit={handleSubmit}
                        recent={!showAutocomplete && mode === "categories"} // Only show recents in categories mode
                        name={"search-page"}
                        setFocused={handleSetFocused}
                        autocompleteSuggestions={autocompleteSuggestions}
                        onSelectSuggestion={handleSelectSuggestion}
                        showAutocomplete={showAutocomplete && mode === "categories"} // Only show autocomplete in categories mode
                    />
                    <View style={{ paddingBottom: 8 }}>
                        <SegmentedControl
                            options={["Blueprints", "Friends"]}
                            selectedOption={activeTab === 0 ? "Blueprints" : "Friends"}
                            onOptionPress={handleTogglePress}
                        />
                    </View>
                </View>
            </View>
            <CustomAlert
                visible={alertVisible}
                setVisible={setAlertVisible}
                title={alertTitle}
                message={alertMessage}
                buttons={alertButtons}
            />
            <ContactConsentModal
                visible={consentModalVisible}
                onAccept={handleConsentAccept}
                onDecline={handleConsentDecline}
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
        },
        betterTogetherContainer: {
            paddingHorizontal: 16,
            paddingBottom: 16,
        },
        scrollView: {
            paddingVertical: Dimensions.get("screen").height * 0.03,
            paddingTop: 80,
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

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
    TextInput,
    TextInputProps,
    StyleSheet,
    View,
    Dimensions,
    TouchableOpacity,
    Image,
    Animated,
} from "react-native";
import { ThemedText } from "./ThemedText";
import { useRecentSearch, RecentSearchItem } from "@/hooks/useRecentSearch";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Keyboard } from "react-native";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { MagnifyingGlass, X, User, Package } from "phosphor-react-native";

export interface AutocompleteSuggestion {
    id: string;
    display_name?: string;
    handle?: string;
    name?: string;
    profile_picture?: string;
    banner?: string;
    type: "user" | "blueprint";
}

interface SearchBoxProps extends TextInputProps {
    value: string;
    recent?: boolean;
    name?: string;
    onSubmit: (searchText?: string) => void;
    onChangeText: (text: string) => void;
    icon?: React.ReactNode;
    setFocused?: (focused: boolean) => void;
    autocompleteSuggestions?: AutocompleteSuggestion[];
    onSelectSuggestion?: (suggestion: AutocompleteSuggestion) => void;
    showAutocomplete?: boolean;
}

const base = 393;
const scale = Dimensions.get("screen").width / base;

export function SearchBox({
    value,
    placeholder,
    onChangeText,
    onSubmit,
    icon,
    recent,
    name,
    setFocused,
    autocompleteSuggestions = [],
    onSelectSuggestion,
    showAutocomplete = false,
    ...rest
}: SearchBoxProps) {
    const { getRecents, appendSearch, deleteRecent, isLoading } = useRecentSearch(name);
    const [inputHeight, setInputHeight] = useState(0);
    const inputRef = useRef<TextInput>(null);
    const ThemedColor = useThemeColor();

    const [recentItems, setRecentItems] = useState<RecentSearchItem[]>([]);
    const [showResults, setShowResults] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);
    const [isFocused, setIsFocused] = useState(false);

    const resultsOpacity = useRef(new Animated.Value(0)).current;
    const iconTransition = useRef(new Animated.Value(0)).current;
    const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isMountedRef = useRef(true);

    const shouldShowAutocomplete = showAutocomplete && autocompleteSuggestions.length > 0;
    const shouldShowRecents = recent && recentItems.length > 0 && !shouldShowAutocomplete && isFocused;
    const shouldShowLoading = recent && isLoading && isFocused && !shouldShowAutocomplete;

    useEffect(() => {
        if (shouldShowAutocomplete || shouldShowRecents || shouldShowLoading) {
            setShowResults(true);
            Animated.parallel([
                Animated.timing(resultsOpacity, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.timing(iconTransition, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();
        } else if (!shouldShowAutocomplete && !shouldShowRecents && !shouldShowLoading && showResults) {
            Animated.parallel([
                Animated.timing(resultsOpacity, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.timing(iconTransition, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start(() => {
                if (isMountedRef.current) {
                    setShowResults(false);
                }
            });
        }
    }, [shouldShowAutocomplete, shouldShowRecents, shouldShowLoading]);

    const fetchRecents = useCallback(async () => {
        if (recent && !showAutocomplete) {
            const recents = await getRecents();
            if (isMountedRef.current) {
                setRecentItems(recents);
                if (setFocused) setFocused(true);
            }
        }
    }, [recent, showAutocomplete, getRecents, setFocused]);

    const clearRecents = useCallback(() => {
        if (blurTimeoutRef.current) {
            clearTimeout(blurTimeoutRef.current);
            blurTimeoutRef.current = null;
        }

        setIsAnimating(true);

        Animated.parallel([
            Animated.timing(resultsOpacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(iconTransition, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start(() => {
            if (isMountedRef.current) {
                setShowResults(false);
                setRecentItems([]);
                setIsAnimating(false);
                setIsFocused(false);
                if (setFocused) setFocused(false);
            }
        });
    }, [resultsOpacity, iconTransition, setFocused]);

    const deleteRecentItem = useCallback(
        async (id: string) => {
            await deleteRecent(id);
            fetchRecents();
        },
        [deleteRecent, fetchRecents]
    );

    const clear = useCallback(() => {
        onChangeText("");
        clearRecents();
        Keyboard.dismiss();
    }, [onChangeText, clearRecents]);

    useEffect(() => {
        isMountedRef.current = true;

        if (inputRef.current) {
            inputRef.current.measureInWindow((x, y, width, height) => {
                if (isMountedRef.current) {
                    setInputHeight(y + height + 8);
                }
            });
        }

        return () => {
            isMountedRef.current = false;
            if (blurTimeoutRef.current) {
                clearTimeout(blurTimeoutRef.current);
            }
        };
    }, []);

    const handleFocus = useCallback(() => {
        if (blurTimeoutRef.current) {
            clearTimeout(blurTimeoutRef.current);
            blurTimeoutRef.current = null;
        }

        setIsFocused(true);

        if (recent && !showAutocomplete) {
            fetchRecents();
        }
    }, [recent, showAutocomplete, fetchRecents]);

    const handleBlur = useCallback(() => {
        if (blurTimeoutRef.current) {
            clearTimeout(blurTimeoutRef.current);
        }

        blurTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) {
                setIsFocused(false);
                if (showResults && !isAnimating) {
                    clearRecents();
                }
            }
        }, 250);
    }, [showResults, isAnimating, clearRecents]);

    const handleItemPress = useCallback(
        async (item: RecentSearchItem | AutocompleteSuggestion) => {
            if (blurTimeoutRef.current) {
                clearTimeout(blurTimeoutRef.current);
                blurTimeoutRef.current = null;
            }

            const isRecentItem = (i: RecentSearchItem | AutocompleteSuggestion): i is RecentSearchItem => {
                return "text" in i || "timestamp" in i;
            };

            if (isRecentItem(item) && item.type === "text" && item.text) {
                const searchText = item.text.trim();
                if (searchText) {
                    onChangeText(searchText);
                    clearRecents();
                    inputRef.current?.blur();
                    setTimeout(() => {
                        onSubmit(searchText);
                    }, 10);
                }
            } else if (onSelectSuggestion) {
                if (isRecentItem(item) && item.type !== "text") {
                    const suggestion: AutocompleteSuggestion = {
                        id: item.id,
                        display_name: item.display_name,
                        handle: item.handle,
                        name: item.name,
                        profile_picture: item.profile_picture,
                        banner: item.banner,
                        type: item.type as "user" | "blueprint",
                    };
                    await appendSearch(item);
                    clearRecents();
                    onSelectSuggestion(suggestion);
                } else if (!isRecentItem(item)) {
                    const recentItem: RecentSearchItem = {
                        id: item.id,
                        display_name: item.display_name,
                        handle: item.handle,
                        name: item.name,
                        profile_picture: item.profile_picture,
                        banner: item.banner,
                        type: item.type,
                        timestamp: Date.now(),
                    };
                    await appendSearch(recentItem);
                    clearRecents();
                    onSelectSuggestion(item);
                }
            }
        },
        [onChangeText, onSubmit, onSelectSuggestion, appendSearch, clearRecents]
    );

    const onSubmitEditing = useCallback(() => {
        if (recent && value.trim() && !isAnimating) {
            appendSearch(value);
        }
        onSubmit();
        inputRef.current?.blur();
        clearRecents();
    }, [recent, value, isAnimating, appendSearch, onSubmit, clearRecents]);

    const styles = useStyles(ThemedColor);
    const showClearButton = showResults || value.length > 0;

    return (
        <View>
            <View style={styles.container}>
                <TextInput
                    id="search-input"
                    placeholder={placeholder}
                    ref={inputRef}
                    onSubmitEditing={onSubmitEditing}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    value={value}
                    onChangeText={onChangeText}
                    {...rest}
                    style={{ ...styles.input, color: ThemedColor.text }}
                    placeholderTextColor={ThemedColor.caption}
                />
                <TouchableOpacity
                    onPress={showClearButton ? clear : undefined}
                    disabled={!showClearButton}
                    style={[
                        styles.iconButton,
                        {
                            backgroundColor: showClearButton ? "transparent" : ThemedColor.primary,
                        },
                    ]}>
                    {showClearButton ? (
                        <X size={20} color={ThemedColor.text} weight="light" />
                    ) : (
                        <MagnifyingGlass size={20} color={ThemedColor.buttonText} weight="light" />
                    )}
                </TouchableOpacity>
            </View>

            {(showResults || isLoading) && (
                <Animated.View
                    style={[
                        styles.recentsContainer,
                        {
                            top: inputHeight,
                            opacity: resultsOpacity,
                        },
                    ]}
                    pointerEvents={showResults ? "auto" : "none"}>
                    {shouldShowAutocomplete ? (
                        autocompleteSuggestions.map((suggestion) => (
                            <SuggestionItem
                                key={suggestion.id}
                                item={suggestion}
                                onPress={() => handleItemPress(suggestion)}
                                ThemedColor={ThemedColor}
                                styles={styles}
                            />
                        ))
                    ) : shouldShowRecents ? (
                        recentItems.map((item) => (
                            <RecentItem
                                key={item.id}
                                item={item}
                                onPress={() => handleItemPress(item)}
                                onDelete={() => deleteRecentItem(item.id)}
                                ThemedColor={ThemedColor}
                                styles={styles}
                            />
                        ))
                    ) : shouldShowLoading ? (
                        <View style={styles.recent}>
                            <ThemedText type="default" style={{ opacity: 0.5 }}>
                                Loading recent searches...
                            </ThemedText>
                        </View>
                    ) : null}
                </Animated.View>
            )}
        </View>
    );
}

const SuggestionItem = React.memo(({ item, onPress, ThemedColor, styles }: any) => {
    const displayText = item.type === "user" ? item.display_name : item.name;
    const subtitle = item.type === "user" ? item.handle : "Blueprint";
    const imageUri = item.type === "user" ? item.profile_picture : item.banner;
    const isUser = item.type === "user";

    return (
        <TouchableOpacity style={styles.recent} activeOpacity={0.7} onPress={onPress}>
            <View style={{ flexDirection: "row", gap: 12, alignItems: "center", flex: 1 }}>
                {imageUri ? (
                    <Image source={{ uri: imageUri }} style={isUser ? styles.userImage : styles.blueprintImage} />
                ) : (
                    <View style={isUser ? styles.placeholderUser : styles.placeholderBlueprint}>
                        {isUser ? (
                            <User size={16} color={ThemedColor.background} weight="light" />
                        ) : (
                            <Package size={16} color={ThemedColor.background} weight="light" />
                        )}
                    </View>
                )}
                <View style={{ flex: 1 }}>
                    <ThemedText type="default" style={{ fontWeight: "600" }}>
                        {displayText}
                    </ThemedText>
                    <ThemedText type="default" style={{ fontSize: 12, opacity: 0.7 }}>
                        {subtitle}
                    </ThemedText>
                </View>
            </View>
        </TouchableOpacity>
    );
});

const RecentItem = React.memo(({ item, onPress, onDelete, ThemedColor, styles }: any) => {
    const displayText = item.type === "user" ? item.display_name : item.type === "blueprint" ? item.name : item.text;
    const subtitle = item.type === "user" ? item.handle : item.type === "blueprint" ? "Blueprint" : null;
    const imageUri = item.type === "user" ? item.profile_picture : item.type === "blueprint" ? item.banner : null;
    const isUser = item.type === "user";
    const isText = item.type === "text";

    return (
        <TouchableOpacity style={styles.recent} activeOpacity={0.7} onPress={onPress}>
            <View style={{ flexDirection: "row", gap: 12, alignItems: "center", flex: 1 }}>
                {isText ? (
                    <MagnifyingGlass size={20} color={ThemedColor.text} weight="light" />
                ) : imageUri ? (
                    <Image source={{ uri: imageUri }} style={isUser ? styles.userImage : styles.blueprintImage} />
                ) : (
                    <View style={isUser ? styles.placeholderUser : styles.placeholderBlueprint}>
                        {isUser ? (
                            <User size={16} color={ThemedColor.background} weight="light" />
                        ) : (
                            <Package size={16} color={ThemedColor.background} weight="light" />
                        )}
                    </View>
                )}
                <View style={{ flex: 1 }}>
                    <ThemedText type="default" style={{ fontWeight: isText ? "400" : "600" }}>
                        {displayText}
                    </ThemedText>
                    {subtitle && (
                        <ThemedText type="default" style={{ fontSize: 12, opacity: 0.7 }}>
                            {subtitle}
                        </ThemedText>
                    )}
                </View>
            </View>
            <TouchableOpacity
                style={{ paddingLeft: 8, paddingRight: 16 }}
                onPress={(e) => {
                    e.stopPropagation();
                    onDelete();
                }}>
                <X size={20} color={ThemedColor.text} weight="light" />
            </TouchableOpacity>
        </TouchableOpacity>
    );
});

const useStyles = (ThemedColor: any) =>
    StyleSheet.create({
        recentsContainer: {
            flexDirection: "column",
            alignItems: "flex-start",
            position: "absolute",
            width: "100%",
            paddingVertical: 8,
            marginTop: -50, 
            paddingLeft: 16,
            backgroundColor: ThemedColor.lightened,
            zIndex: 10,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: ThemedColor.tertiary,
            boxShadow: ThemedColor.shadowSmall,
        },
        recent: {
            width: "100%",
            padding: 8,
            paddingVertical: 12,
            flexDirection: "row",
            flex: 1,
            gap: 12,
            justifyContent: "space-between",
        },
        container: {
            flexDirection: "row",
            alignItems: "center",
            width: "100%",
            borderRadius: 100,
            borderWidth: 1,
            borderColor: ThemedColor.tertiary,
            paddingLeft: HORIZONTAL_PADDING,
            paddingRight: HORIZONTAL_PADDING / 3,
            paddingVertical: 8,
            backgroundColor: ThemedColor.lightened,
            boxShadow: ThemedColor.shadowSmall,
        },
        input: {
            flex: 1,
            fontSize: 16 * scale,
            fontFamily: "OutfitLight",
            alignItems: "flex-start",
            zIndex: 5,
            paddingVertical: 8,
        },
        iconButton: {
            padding: 12,
            borderRadius: 30,
            width: 44,
            height: 44,
            justifyContent: "center",
            alignItems: "center",
        },
        userImage: {
            width: 40,
            height: 40,
            borderRadius: 20,
        },
        blueprintImage: {
            width: 56,
            height: 40,
            borderRadius: 8,
        },
        placeholderUser: {
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: ThemedColor.primary,
            justifyContent: "center",
            alignItems: "center",
        },
        placeholderBlueprint: {
            width: 56,
            height: 40,
            borderRadius: 8,
            backgroundColor: ThemedColor.primary,
            justifyContent: "center",
            alignItems: "center",
        },
    });

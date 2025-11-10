import React, { useEffect, useRef, useState } from "react";
import { TextInput, TextInputProps, StyleSheet, View, Dimensions, TouchableOpacity, Image, Animated } from "react-native";
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
    onSubmit: () => void;
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
    const { getRecents, appendSearch, deleteRecent } = useRecentSearch(name);
    const [inputHeight, setInputHeight] = useState(0);
    const inputRef = useRef<TextInput>(null);
    let ThemedColor = useThemeColor();

    const [recentItems, setRecentItems] = useState<RecentSearchItem[]>([]);
    const [showResults, setShowResults] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);
    
    // Debug logging
    useEffect(() => {
        console.log('📦 SearchBox props:', { 
            showAutocomplete, 
            suggestionsCount: autocompleteSuggestions.length,
            recent 
        });
    }, [showAutocomplete, autocompleteSuggestions.length, recent]);
    
    // Animation values
    const resultsHeight = useRef(new Animated.Value(0)).current;
    const resultsOpacity = useRef(new Animated.Value(0)).current;
    const iconTransition = useRef(new Animated.Value(0)).current;
    const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    
    // Animate autocomplete suggestions
    useEffect(() => {
        if (showAutocomplete && autocompleteSuggestions.length > 0) {
            Animated.parallel([
                Animated.spring(resultsHeight, {
                    toValue: 1,
                    tension: 60,
                    friction: 10,
                    useNativeDriver: false,
                }),
                Animated.timing(resultsOpacity, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: false,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(resultsHeight, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: false,
                }),
                Animated.timing(resultsOpacity, {
                    toValue: 0,
                    duration: 150,
                    useNativeDriver: false,
                }),
            ]).start();
        }
    }, [showAutocomplete, autocompleteSuggestions.length]);

    async function fetchRecents() {
        if (recent) {
            const recents = await getRecents();
            
            setRecentItems(recents);
            setFocused(true);
            
            // Animate in results
            if (recents.length > 0) {
                setShowResults(true);
                Animated.parallel([
                    Animated.spring(resultsHeight, {
                        toValue: 1,
                        tension: 60,
                        friction: 10,
                        useNativeDriver: false, // Can't use native driver with maxHeight
                    }),
                    Animated.spring(iconTransition, {
                        toValue: 1,
                        tension: 100,
                        friction: 10,
                        useNativeDriver: true,
                    }),
                ]).start();
            }
        } else await clearRecents();
    }
    async function clearRecents() {
        // Clear any pending blur timeout
        if (blurTimeoutRef.current) {
            clearTimeout(blurTimeoutRef.current);
            blurTimeoutRef.current = null;
        }
        
        // Immediately start hiding if no items or already hidden
        if (!showResults && recentItems.length === 0) {
            if (setFocused) setFocused(false);
            return;
        }
        
        // If already animating, stop the current animation and restart
        if (isAnimating) {
            resultsHeight.stopAnimation();
            iconTransition.stopAnimation();
        }
        
        setIsAnimating(true);
        
        // Animate out results - DON'T hide until animation completes
        Animated.parallel([
            Animated.timing(resultsHeight, {
                toValue: 0,
                duration: 200,
                useNativeDriver: false, // Can't use native driver with maxHeight
            }),
            Animated.spring(iconTransition, {
                toValue: 0,
                tension: 100,
                friction: 10,
                useNativeDriver: true,
            }),
        ]).start(({ finished }) => {
            // Update state even if animation was interrupted
            setShowResults(false);
        setRecentItems([]);
            setIsAnimating(false);
        if (setFocused) setFocused(false);
        });
    }
    async function deleteRecentItem(id: string) {
        deleteRecent(id).then(() => fetchRecents());
    }

    const clear = () => {
        clearRecents();
        onChangeText("");
        // Don't call onSubmit() - just clear the input
        Keyboard.dismiss();
    };

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current?.measureInWindow((height) => {
                setInputHeight(height + Dimensions.get("window").height * 0.01);
            });
        }
        
        // Cleanup timeout on unmount
        return () => {
            if (blurTimeoutRef.current) {
                clearTimeout(blurTimeoutRef.current);
            }
        };
    }, [inputRef]);
    
    const onSubmitEditing = () => {
        if (recent)
            appendSearch(value).then(() => {
                fetchRecents();
            });
        onSubmit();
        inputRef.current?.blur();
    };

    const styles = useStyles(ThemedColor);

    return (
        <View>
            <View style={styles.container}>
                <TextInput
                    id={"search-input"}
                    placeholder={placeholder}
                    ref={inputRef}
                    onSubmitEditing={onSubmitEditing}
                    onFocus={() => {
                        // Clear any pending blur
                        if (blurTimeoutRef.current) {
                            clearTimeout(blurTimeoutRef.current);
                            blurTimeoutRef.current = null;
                        }
                        // Only fetch recents if in recent mode
                        if (recent) {
                            fetchRecents();
                        }
                    }}
                    onBlur={() => {
                        // Delay clearRecents to allow tap events to fire
                        // But ensure we always clear eventually
                        if (blurTimeoutRef.current) {
                            clearTimeout(blurTimeoutRef.current);
                        }
                        blurTimeoutRef.current = setTimeout(() => {
                            // Force clear even if already animating
                            if (showResults || recentItems.length > 0) {
                                clearRecents();
                            }
                        }, 150);
                    }}
                    value={value}
                    onChangeText={onChangeText}
                    {...rest}
                    style={{ ...styles.input, color: ThemedColor.text }}
                    placeholderTextColor={ThemedColor.caption}
                />
                <Animated.View
                        style={{
                            padding: 12,
                        borderRadius: 30,
                        backgroundColor: iconTransition.interpolate({
                            inputRange: [0, 1],
                            outputRange: [ThemedColor.primary, 'transparent']
                        }),
                        transform: [{
                            scale: iconTransition.interpolate({
                                inputRange: [0, 0.5, 1],
                                outputRange: [1, 0.8, 1]
                            })
                        }],
                        boxShadow: ThemedColor.shadowSmall,
                        position: 'relative',
                        width: 44,
                        height: 44,
                        justifyContent: 'center',
                        alignItems: 'center',
                        }}>
                    <TouchableOpacity 
                        onPress={clear} 
                        disabled={!showResults}
                        style={{ 
                            position: 'absolute',
                            width: '100%',
                            height: '100%',
                            justifyContent: 'center',
                            alignItems: 'center',
                        }}
                    >
                        <Animated.View style={{
                            opacity: iconTransition,
                            transform: [{
                                rotate: iconTransition.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: ['90deg', '0deg']
                                })
                            }],
                        }}>
                            <X size={20} color={ThemedColor.text} weight="light" />
                        </Animated.View>
                        </TouchableOpacity>
                    <Animated.View style={{
                        opacity: iconTransition.interpolate({
                            inputRange: [0, 1],
                            outputRange: [1, 0]
                        }),
                        position: 'absolute',
                        }}>
                        <MagnifyingGlass size={20} color={ThemedColor.buttonText} weight="light" />
                    </Animated.View>
                </Animated.View>
            </View>
            {recent && showResults && recentItems.length > 0 && (
                <Animated.View 
                    style={[
                        styles.recentsContainer, 
                        { 
                            top: inputHeight,
                            overflow: 'hidden',
                            maxHeight: resultsHeight.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, 400], // Max height for recent searches
                            }),
                        }
                    ]}
                >
                    {recentItems.map((item: RecentSearchItem, index: number) => {
                        const displayText =
                            item.type === "user"
                                ? item.display_name
                                : item.type === "blueprint"
                                  ? item.name
                                  : item.text;
                        const subtitle =
                            item.type === "user" ? item.handle : item.type === "blueprint" ? "Blueprint" : null;

                        const imageUri =
                            item.type === "user"
                                ? item.profile_picture
                                : item.type === "blueprint"
                                  ? item.banner
                                  : null;

                        const isUser = item.type === "user";
                        const isBlueprint = item.type === "blueprint";
                        const isText = item.type === "text";

                        return (
                            <TouchableOpacity
                                key={item.id}
                                style={styles.recent}
                                activeOpacity={0.7}
                                onPress={() => {
                                    if (isText) {
                                        inputRef.current?.blur();
                                        onChangeText(item.text || "");
                                        onSubmit();
                                        clearRecents();
                                    } else if (onSelectSuggestion) {
                                        // Convert to AutocompleteSuggestion and trigger selection
                                        onSelectSuggestion({
                                            id: item.id,
                                            display_name: item.display_name,
                                            handle: item.handle,
                                            name: item.name,
                                            profile_picture: item.profile_picture,
                                            banner: item.banner,
                                            type: item.type as "user" | "blueprint",
                                        });
                                        clearRecents();
                                    }
                                }}>
                                <View style={{ flexDirection: "row", gap: 12, alignItems: "center", flex: 1 }}>
                                    {isText ? (
                                        <MagnifyingGlass size={20} color={ThemedColor.text} weight="light" />
                                    ) : imageUri ? (
                                        <Image
                                            source={{ uri: imageUri }}
                                            style={isUser ? styles.userImage : styles.blueprintImage}
                                        />
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
                                    style={{ paddingRight: 16 }}
                                    onPress={() => deleteRecentItem(item.id)}>
                                    <X size={20} color={ThemedColor.text} weight="light" />
                                </TouchableOpacity>
                            </TouchableOpacity>
                        );
                    })}
                </Animated.View>
            )}
            {showAutocomplete && (
                <Animated.View 
                    style={[
                        styles.recentsContainer, 
                        { 
                            top: inputHeight,
                            overflow: 'hidden',
                            maxHeight: resultsHeight.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, 400],
                            }),
                            opacity: resultsOpacity,
                        }
                    ]}
                    pointerEvents={autocompleteSuggestions.length > 0 ? 'auto' : 'none'}
                >
                    {autocompleteSuggestions.map((suggestion: AutocompleteSuggestion) => {
                        const displayText = suggestion.type === "user" ? suggestion.display_name : suggestion.name;
                        const subtitle = suggestion.type === "user" ? suggestion.handle : "Blueprint";

                        // Get the image to display
                        const imageUri = suggestion.type === "user" ? suggestion.profile_picture : suggestion.banner;

                        // For users, use circular image; for blueprints, use rounded rectangle
                        const isUser = suggestion.type === "user";

                        return (
                            <TouchableOpacity
                                key={suggestion.id}
                                style={styles.recent}
                                activeOpacity={0.7}
                                onPress={() => {
                                    if (onSelectSuggestion) {
                                        onSelectSuggestion(suggestion);
                                    }
                                }}>
                                <View style={{ flexDirection: "row", gap: 12, alignItems: "center", flex: 1 }}>
                                    {imageUri ? (
                                        <Image
                                            source={{ uri: imageUri }}
                                            style={isUser ? styles.userImage : styles.blueprintImage}
                                        />
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
                    })}
                </Animated.View>
            )}
        </View>
    );
}

const useStyles = (ThemedColor: any) =>
    StyleSheet.create({
        recentsContainer: {
            flexDirection: "column",
            alignItems: "flex-start",
            position: "absolute",
            width: "100%",
            paddingVertical: 8,
            marginTop: 26,
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
        icon: {
            marginLeft: 8,
            resizeMode: "contain",
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

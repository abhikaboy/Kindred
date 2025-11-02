import React, { useEffect, useRef, useState } from "react";
import { TextInput, TextInputProps, StyleSheet, View, Dimensions, TouchableOpacity, Image } from "react-native";
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

    async function fetchRecents() {
        if (recent) {
            setRecentItems(await getRecents());
            setFocused(true);
        } else await clearRecents();
    }
    async function clearRecents() {
        setRecentItems([]);
        if (setFocused) setFocused(false);
    }
    async function deleteRecentItem(id: string) {
        deleteRecent(id).then(() => fetchRecents());
    }

    const clear = () => {
        setRecentItems([]);
        if (setFocused) setFocused(false);
        onChangeText("");
        onSubmit();
        setFocused(false);
        Keyboard.dismiss();
    };

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current?.measureInWindow((height) => {
                setInputHeight(height + Dimensions.get("window").height * 0.01);
            });
        }
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
                    onFocus={() => fetchRecents()}
                    onBlur={() => clearRecents()}
                    onEndEditing={() => clearRecents()}
                    value={value}
                    onChangeText={onChangeText}
                    {...rest}
                    style={{ ...styles.input, color: ThemedColor.text }}
                    placeholderTextColor={ThemedColor.caption}
                />
                {recentItems.length > 0 ? (
                    <View
                        style={{
                            padding: 12,
                        }}>
                        <TouchableOpacity onPress={clear}>
                            <X size={24} color={ThemedColor.text} weight="light" />
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View
                        style={{
                            backgroundColor: ThemedColor.primary,
                            padding: 12,
                            borderRadius: 30,
                            boxShadow: ThemedColor.shadowSmall,
                        }}>
                        <MagnifyingGlass size={20} color={ThemedColor.buttonText} weight="light" />
                    </View>
                )}
            </View>
            {recent && recentItems.length > 0 && (
                <View style={{ ...styles.recentsContainer, top: inputHeight }}>
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
                </View>
            )}
            {showAutocomplete && autocompleteSuggestions.length > 0 && (
                <View style={{ ...styles.recentsContainer, top: inputHeight }}>
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
                </View>
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

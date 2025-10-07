import React, { useEffect, useRef, useState } from "react";
import { TextInput, TextInputProps, StyleSheet, View, Dimensions, TouchableOpacity, Touchable, Image } from "react-native";
import { ThemedText } from "./ThemedText";
import { useRecentSearch } from "@/hooks/useRecentSearch";
import { IconSymbol } from "./ui/IconSymbol";
import Octicons from "@expo/vector-icons/Octicons";
import Entypo from "@expo/vector-icons/Entypo";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Keyboard } from "react-native";
import { HORIZONTAL_PADDING } from "@/constants/spacing";

export interface AutocompleteSuggestion {
    id: string;
    display_name?: string;
    handle?: string;
    name?: string;
    profile_picture?: string;
    banner?: string;
    type: 'user' | 'blueprint';
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
    const [recentItems, setRecentItems] = useState<string[]>([]);

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
    async function deleteRecentItem(term: string) {
        deleteRecent(term).then(() => fetchRecents());
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
                />
                {recentItems.length > 0 ? (
                    <TouchableOpacity onPress={clear}>
                        <Octicons name="x" size={24} color={ThemedColor.text} />
                    </TouchableOpacity>
                ) : (
                    <Octicons name="search" size={24} color={ThemedColor.text} />
                )}
            </View>
            {recent && recentItems.length > 0 && (
                <View style={{ ...styles.recentsContainer, top: inputHeight }}>
                    {recentItems.map((term: string, index: number) => {
                        return (
                            <TouchableOpacity
                                key={index}
                                style={styles.recent}
                                onPress={() => {
                                    inputRef.current?.blur();
                                    onSubmit();
                                    appendSearch(term);
                                    clearRecents();
                                    onChangeText(term);
                                }}>
                                <View style={{ flexDirection: "row", gap: 10 }}>
                                    <Octicons name="search" size={20} color={ThemedColor.text} />
                                    <ThemedText>{term}</ThemedText>
                                </View>
                                <TouchableOpacity style={{ paddingRight: 16 }} onPress={() => deleteRecentItem(term)}>
                                    <Entypo name="cross" size={20} color={ThemedColor.text} />
                                </TouchableOpacity>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            )}
            {showAutocomplete && autocompleteSuggestions.length > 0 && (
                <View style={{ ...styles.recentsContainer, top: inputHeight }}>
                    {autocompleteSuggestions.map((suggestion: AutocompleteSuggestion) => {
                        const displayText = suggestion.type === 'user' 
                            ? suggestion.display_name 
                            : suggestion.name;
                        const subtitle = suggestion.type === 'user' 
                            ? `@${suggestion.handle}` 
                            : 'Blueprint';
                        
                        // Get the image to display
                        const imageUri = suggestion.type === 'user' 
                            ? suggestion.profile_picture 
                            : suggestion.banner;
                        
                        // For users, use circular image; for blueprints, use rounded rectangle
                        const isUser = suggestion.type === 'user';
                        
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
                                            <Octicons 
                                                name={isUser ? "person" : "package"} 
                                                size={16} 
                                                color={ThemedColor.background} 
                                            />
                                        </View>
                                    )}
                                    <View style={{ flex: 1 }}>
                                        <ThemedText style={{ fontWeight: '600' }}>{displayText}</ThemedText>
                                        <ThemedText style={{ fontSize: 12, opacity: 0.7 }}>{subtitle}</ThemedText>
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
            paddingLeft: 16,
            backgroundColor: ThemedColor.lightened,
            zIndex: 10,
            borderBottomLeftRadius: 24,
            borderBottomRightRadius: 24,
        },
        recent: {
            width: "100%",
            padding: 8,
            paddingVertical: 12,
            backgroundColor: ThemedColor.lightened,
            flexDirection: "row",
            flex: 1,
            gap: 12,
            justifyContent: "space-between",
        },
        container: {
            flexDirection: "row",
            alignItems: "center",
            width: "100%",
            borderRadius: 12,
            paddingHorizontal: HORIZONTAL_PADDING,
            paddingVertical: 16,
            backgroundColor: ThemedColor.lightened,
        },
        input: {
            flex: 1,
            fontFamily: "Outfit",
            fontSize: 16,
            alignItems: "flex-start",
            zIndex: 5,
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
            justifyContent: 'center',
            alignItems: 'center',
        },
        placeholderBlueprint: {
            width: 56,
            height: 40,
            borderRadius: 8,
            backgroundColor: ThemedColor.primary,
            justifyContent: 'center',
            alignItems: 'center',
        },
    });

import React, { useEffect, useRef, useState } from "react";
import { TextInput, TextInputProps, StyleSheet, View, Dimensions, TouchableOpacity, Touchable } from "react-native";
import { ThemedText } from "./ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useRecentSearch } from "@/hooks/useRecentSearch";
import ThemedColor from "@/constants/Colors";
import { IconSymbol } from "./ui/IconSymbol";
import Octicons from "@expo/vector-icons/Octicons";
import Entypo from "@expo/vector-icons/Entypo";

interface SearchBoxProps extends TextInputProps {
    value: string;
    recent?: boolean;
    name?: string;
    onSubmit: () => void;
    onChangeText: (text: string) => void;
    icon?: React.ReactNode;
    setFocused?: (focused: boolean) => void;
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
    ...rest
}: SearchBoxProps) {
    const { getRecents, appendSearch, deleteRecent } = useRecentSearch(name);
    const [inputHeight, setInputHeight] = useState(0);
    const inputRef = useRef<TextInput>(null);
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
                <Octicons name="search" size={24} color="white" />
            </View>
            {recent && (
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
                                    <Octicons name="search" size={24} color="white" />
                                    <ThemedText>{term}</ThemedText>
                                </View>
                                <TouchableOpacity onPress={() => deleteRecentItem(term)}>
                                    <Entypo name="cross" size={24} color="white" />
                                </TouchableOpacity>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    recentsContainer: {
        flexDirection: "column",
        alignItems: "flex-start",
        position: "absolute",
        width: "100%",
        backgroundColor: ThemedColor.background,
        zIndex: 10,
    },
    recent: {
        width: "100%",
        padding: 20,
        paddingVertical: 16,
        backgroundColor: ThemedColor.background,
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
        paddingHorizontal: 24,
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
});

import React, { useState, useRef, useEffect } from "react";
import { View, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Animated, Dimensions } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useTasks } from "@/contexts/tasksContext";
import { useRequest } from "@/hooks/useRequest";
import { Plus, X } from "phosphor-react-native";

const SCREEN_SCALE = Dimensions.get("screen").width / 393;

type Props = {
    onCreated?: (categoryId: string, categoryName: string) => void;
    onCancel: () => void;
};

const InlineCategoryCreator = ({ onCreated, onCancel }: Props) => {
    const [name, setName] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const inputRef = useRef<TextInput>(null);
    const mountedRef = useRef(true);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const ThemedColor = useThemeColor();
    const { selected, addToWorkspace } = useTasks();
    const { request } = useRequest();

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
        }).start();
        setTimeout(() => inputRef.current?.focus(), 150);
        return () => { mountedRef.current = false; };
    }, []);

    const animateOut = (callback: () => void) => {
        Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
        }).start(callback);
    };

    const handleCreate = async () => {
        const trimmed = name.trim();
        if (trimmed.length === 0 || loading) return;

        setLoading(true);
        setError(false);
        try {
            const response = await request("POST", `/user/categories`, {
                name: trimmed,
                workspaceName: selected,
            });
            if (!mountedRef.current) return;
            addToWorkspace(selected, response);
            animateOut(() => onCreated?.(response.id, trimmed));
        } catch (e) {
            if (!mountedRef.current) return;
            setError(true);
            setLoading(false);
            inputRef.current?.focus();
        }
    };

    const handleCancel = () => {
        animateOut(onCancel);
    };

    return (
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
            <TextInput
                ref={inputRef}
                value={name}
                onChangeText={(text) => {
                    setName(text);
                    if (error) setError(false);
                }}
                onSubmitEditing={handleCreate}
                placeholder="Category name"
                placeholderTextColor={error ? ThemedColor.error : ThemedColor.caption}
                returnKeyType="done"
                editable={!loading}
                style={[
                    styles.input,
                    { color: error ? ThemedColor.error : ThemedColor.text },
                ]}
            />
            <View style={styles.actions}>
                {loading ? (
                    <ActivityIndicator size="small" color={ThemedColor.primary} />
                ) : (
                    <>
                        <TouchableOpacity onPress={handleCancel} hitSlop={8}>
                            <View style={[styles.iconCircle, { backgroundColor: ThemedColor.lightened }]}>
                                <X size={14} weight="bold" color={ThemedColor.caption} />
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={handleCreate}
                            disabled={name.trim().length === 0}
                            hitSlop={8}
                        >
                            <View
                                style={[
                                    styles.iconCircle,
                                    {
                                        backgroundColor: name.trim().length > 0
                                            ? ThemedColor.primary
                                            : ThemedColor.primary + "40",
                                    },
                                ]}
                            >
                                <Plus size={14} weight="bold" color="#FFFFFF" />
                            </View>
                        </TouchableOpacity>
                    </>
                )}
            </View>
        </Animated.View>
    );
};

export default InlineCategoryCreator;

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        alignSelf: "stretch",
        gap: 12,
    },
    input: {
        flex: 1,
        fontSize: 18 * SCREEN_SCALE,
        fontWeight: "500",
        fontFamily: "Outfit",
        padding: 0,

    },
    actions: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    iconCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
    },
});

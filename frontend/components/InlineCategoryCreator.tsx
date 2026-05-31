import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { View, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Animated, Dimensions } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useTasks } from "@/contexts/tasksContext";
import { useRequest } from "@/hooks/useRequest";
import { Plus, X, Tag } from "phosphor-react-native";
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import { ThemedText } from "@/components/ThemedText";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import TagEditor, { type TagEditorHandle } from "@/components/TagEditor";

const SCREEN_SCALE = Dimensions.get("screen").width / 393;

type Props = {
    onCreated?: (categoryId: string, categoryName: string) => void;
    onCancel: () => void;
    initialName?: string;
};

const InlineCategoryCreator = ({ onCreated, onCancel, initialName }: Props) => {
    const [name, setName] = useState(initialName ?? "");
    const [tags, setTags] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const inputRef = useRef<TextInput>(null);
    const mountedRef = useRef(true);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const ThemedColor = useThemeColor();
    const { selected, addToWorkspace } = useTasks();
    const { request } = useRequest();

    const tagsSheetRef = useRef<BottomSheetModal>(null);
    const tagEditorRef = useRef<TagEditorHandle>(null);
    const tagsSnapPoints = useMemo(() => ["50%"], []);

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
                tags,
            });
            if (!mountedRef.current) return;
            addToWorkspace(selected, { ...response, tasks: response.tasks ?? [], tags: response.tags ?? tags });
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

    const openTagsSheet = () => {
        inputRef.current?.blur();
        tagsSheetRef.current?.present();
    };

    const closeTagsSheet = () => {
        // Commit any tag still in the editor input before closing.
        tagEditorRef.current?.flush();
        tagsSheetRef.current?.dismiss();
    };

    const renderBackdrop = useCallback(
        (backdropProps) => (
            <BottomSheetBackdrop {...backdropProps} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
        ),
        []
    );

    const hasTags = tags.length > 0;
    const sheetTitle = name.trim().length > 0 ? `Tags for "${name.trim()}"` : "Add tags";

    return (
        <>
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
                            <TouchableOpacity onPress={openTagsSheet} hitSlop={8} accessibilityLabel="Add tags">
                                <View
                                    style={[
                                        styles.iconCircle,
                                        { backgroundColor: hasTags ? ThemedColor.primary + "20" : ThemedColor.lightened },
                                    ]}
                                >
                                    <Tag size={14} weight={hasTags ? "fill" : "bold"} color={hasTags ? ThemedColor.primary : ThemedColor.caption} />
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

            <BottomSheetModal
                ref={tagsSheetRef}
                index={0}
                snapPoints={tagsSnapPoints}
                backdropComponent={renderBackdrop}
                handleIndicatorStyle={{ backgroundColor: ThemedColor.text }}
                backgroundStyle={{ backgroundColor: ThemedColor.background }}
                enablePanDownToClose={true}
                onDismiss={() => tagEditorRef.current?.flush()}
            >
                <BottomSheetView style={{ paddingHorizontal: 20, gap: 16, paddingBottom: 24 }}>
                    <ThemedText type="subtitle">{sheetTitle}</ThemedText>
                    <TagEditor ref={tagEditorRef} tags={tags} onChange={setTags} />
                    <PrimaryButton title="Done" onPress={closeTagsSheet} />
                </BottomSheetView>
            </BottomSheetModal>
        </>
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

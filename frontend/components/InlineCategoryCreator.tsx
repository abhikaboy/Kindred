import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { View, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Animated, Dimensions, Easing } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useTasks } from "@/contexts/tasksContext";
import { useRequest } from "@/hooks/useRequest";
import { Plus, X, Tag } from "phosphor-react-native";
import TutorialCursor from "@/components/onboarding/TutorialCursor";
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import { ThemedText } from "@/components/ThemedText";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import TagEditor, { type TagEditorHandle } from "@/components/TagEditor";

const SCREEN_SCALE = Dimensions.get("screen").width / 393;

type Props = {
    onCreated?: (categoryId: string, categoryName: string) => void;
    onCancel: () => void;
    initialName?: string;
    // Onboarding tutorial: type the name in for the user, lock the input,
    // hide the tag button, and point a guiding cursor at the create button.
    tutorial?: boolean;
};

const InlineCategoryCreator = ({ onCreated, onCancel, initialName, tutorial = false }: Props) => {
    const [name, setName] = useState(tutorial ? "" : (initialName ?? ""));
    const [tags, setTags] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [typingDone, setTypingDone] = useState(false);
    const inputRef = useRef<TextInput>(null);
    const mountedRef = useRef(true);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const cursorSlide = useRef(new Animated.Value(-50)).current;
    const cursorScale = useRef(new Animated.Value(1)).current;
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
        // Tutorial types the name itself — don't focus (no keyboard).
        if (!tutorial) setTimeout(() => inputRef.current?.focus(), 150);
        return () => { mountedRef.current = false; };
    }, []);

    // Tutorial: typewriter the name in, then point the cursor at create + pulse
    useEffect(() => {
        if (!tutorial || !initialName) return;
        let i = 0;
        let cancelled = false;
        const tick = () => {
            if (cancelled) return;
            i++;
            setName(initialName.slice(0, i));
            if (i < initialName.length) setTimeout(tick, 110);
            else setTypingDone(true);
        };
        const start = setTimeout(tick, 1200);
        return () => { cancelled = true; clearTimeout(start); };
    }, [tutorial, initialName]);

    useEffect(() => {
        if (!typingDone) return;
        const slide = setTimeout(() => {
            Animated.timing(cursorSlide, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start(() => {
                // pulse loop draws attention now; the "Tap to create" bubble only
                // types in at 5s (labelStartDelay) as a hint if the user is stuck
                Animated.loop(
                    Animated.sequence([
                        Animated.timing(cursorScale, { toValue: 0.7, duration: 650, useNativeDriver: true }),
                        Animated.timing(cursorScale, { toValue: 1, duration: 750, useNativeDriver: true }),
                    ])
                ).start();
            });
        }, 700);
        return () => clearTimeout(slide);
    }, [typingDone]);

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
                    editable={!loading && !tutorial}
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
                            {!tutorial && (
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
                            )}
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

                {/* Tutorial: guiding cursor slides to the create button and pulses */}
                {tutorial && typingDone && (
                    <Animated.View
                        pointerEvents="none"
                        style={[styles.tutorialCursor, { transform: [{ translateX: cursorSlide }] }]}
                    >
                        <TutorialCursor size={30} label="Tap to create" bubbleBelow arrowScale={cursorScale} labelStartDelay={5000} />
                    </Animated.View>
                )}
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
        position: "relative",
    },
    // ponytail: arrow sits on the create (+) button; the bubble drops below it
    // (bubbleBelow) so it clears the X/tag/+ row; tune right/top if it drifts
    tutorialCursor: {
        position: "absolute",
        right: -11,
        top: 4,
        zIndex: 50,
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

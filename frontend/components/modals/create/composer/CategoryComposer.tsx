import React, { useEffect, useRef, useState } from "react";
import {
    Alert,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
    useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Reanimated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { X } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { CaptureBackdrop, ON_DARK, ON_DARK_MUTED, STAGE } from "@/components/capture/CaptureStage";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useRequest } from "@/hooks/useRequest";
import { useTasks } from "@/contexts/tasksContext";

const FADE = { duration: 220, easing: Easing.out(Easing.cubic) };

type Props = {
    visible: boolean;
    setVisible: (visible: boolean) => void;
    /** Where the category goes; defaults to the workspace being viewed. */
    workspace?: string;
    /** Typed in when the composer opens, for the onboarding coach. */
    initialName?: string;
};

/** New category on the dark stage, like the workspace composer: just a name and Create. */
export default function CategoryComposer({ visible, setVisible, workspace, initialName }: Props) {
    const ThemedColor = useThemeColor();
    const scheme = useColorScheme() === "dark" ? "dark" : "light";
    const insets = useSafeAreaInsets();
    const { request } = useRequest();
    const { selected, addToWorkspace } = useTasks();
    const target = workspace || selected || "Personal";

    const [mounted, setMounted] = useState(visible);
    const opacity = useSharedValue(0);
    const closingRef = useRef(false);
    const inputRef = useRef<TextInput>(null);
    const [name, setName] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!visible) {
            if (mounted) close();
            return;
        }
        closingRef.current = false;
        if (initialName) setName(initialName);
        setMounted(true);
        opacity.value = withTiming(1, FADE);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);

    const finishClose = () => {
        if (!closingRef.current) return;
        setMounted(false);
        setName("");
        setSaving(false);
        setVisible(false);
    };

    const close = () => {
        if (closingRef.current) return;
        closingRef.current = true;
        Keyboard.dismiss();
        opacity.value = withTiming(0, FADE, () => {
            runOnJS(finishClose)();
        });
    };

    const trimmed = name.trim();
    const canCreate = trimmed.length > 0 && !saving;

    const submit = async () => {
        if (!canCreate || closingRef.current) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        setSaving(true);
        try {
            const response = await request("POST", `/user/categories`, { name: trimmed, workspaceName: target });
            addToWorkspace(target, response);
            close();
        } catch (err) {
            console.error("Failed to create category:", err);
            setSaving(false);
            Alert.alert("Couldn't create category", "Give it another try.");
        }
    };

    const stackStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ translateY: (1 - opacity.value) * 16 }],
    }));

    if (!mounted) return null;

    return (
        <Modal
            visible
            transparent
            animationType="none"
            statusBarTranslucent
            onRequestClose={close}
            onShow={() => inputRef.current?.focus()}>
            <CaptureBackdrop opacity={opacity} />
            <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" />

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.fill}
                pointerEvents="box-none">
                <Reanimated.View style={[styles.fill, stackStyle]} pointerEvents="box-none">
                    <View style={[styles.topBar, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
                        <TouchableOpacity
                            onPress={close}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel="Close without creating"
                            style={[styles.round, { backgroundColor: STAGE.fillRaised }]}>
                            <X size={18} color={STAGE.text} weight="bold" />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.fill} pointerEvents="box-none" />

                    <View style={styles.stack} pointerEvents="box-none">
                        <ThemedText type="caption" style={styles.caption}>
                            New category
                        </ThemedText>
                        <TextInput
                            ref={inputRef}
                            value={name}
                            onChangeText={setName}
                            onSubmitEditing={submit}
                            placeholder="Name it"
                            placeholderTextColor={ON_DARK_MUTED}
                            returnKeyType="done"
                            keyboardAppearance={scheme}
                            selectionColor={ThemedColor.primary}
                            style={styles.input}
                        />
                        <View style={styles.bar}>
                            <ThemedText type="caption" style={[styles.caption, styles.fill]} numberOfLines={1}>
                                In {target}
                            </ThemedText>
                            <PrimaryButton
                                title="Create"
                                onPress={submit}
                                disabled={!canCreate}
                                style={{
                                    ...styles.confirm,
                                    shadowColor: ThemedColor.primary,
                                    opacity: canCreate ? 1 : 0.4,
                                }}
                            />
                        </View>
                    </View>
                </Reanimated.View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    fill: { flex: 1 },
    topBar: { flexDirection: "row", paddingHorizontal: 16 },
    round: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
    stack: { paddingHorizontal: 16, paddingBottom: 12, gap: 12 },
    caption: { color: ON_DARK_MUTED, paddingHorizontal: 4 },
    // Drawn straight on the scrim, which is black in both themes
    input: {
        color: ON_DARK,
        fontSize: 24,
        fontWeight: 600,
        fontFamily: "Fraunces",
        letterSpacing: -1,
        paddingHorizontal: 4,
        paddingVertical: 8,
    },
    bar: { flexDirection: "row", alignItems: "center", gap: 8 },
    confirm: {
        width: "auto",
        alignSelf: "center",
        paddingVertical: 12,
        paddingHorizontal: 20,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 6,
    },
});

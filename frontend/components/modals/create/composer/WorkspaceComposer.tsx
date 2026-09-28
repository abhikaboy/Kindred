import React, { useEffect, useMemo, useRef, useState } from "react";
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
import * as PhosphorIcons from "phosphor-react-native";
import { SquaresFour, X } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { IconPickerOverlay } from "@/components/ui/IconPickerOverlay";
import { CaptureBackdrop, ON_DARK, ON_DARK_MUTED, STAGE } from "@/components/capture/CaptureStage";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useTasks } from "@/contexts/tasksContext";
import { createWorkspace } from "@/api/workspace";
import { showToastable } from "react-native-toastable";
import DefaultToast from "@/components/ui/DefaultToast";

type PhosphorComponent = React.ComponentType<{ size?: number; weight?: string; color?: string }>;

const FADE = { duration: 220, easing: Easing.out(Easing.cubic) };

type Props = {
    visible: boolean;
    setVisible: (visible: boolean) => void;
    /** Edits this workspace instead of creating one. */
    edit?: { name: string; icon?: string | null; color?: string | null };
};

/**
 * New (or edited) workspace on the same dark stage as the task composer: the
 * name is written like a heading, with its icon beside it and the action below.
 */
export default function WorkspaceComposer({ visible, setVisible, edit }: Props) {
    const ThemedColor = useThemeColor();
    const scheme = useColorScheme() === "dark" ? "dark" : "light";
    const insets = useSafeAreaInsets();
    const styles = useMemo(() => makeStyles(), []);
    const { addWorkspace, doesWorkspaceExist, setSelected, renameWorkspace, updateWorkspaceIconColor } = useTasks();

    const [mounted, setMounted] = useState(visible);
    const opacity = useSharedValue(0);
    const closingRef = useRef(false);
    const inputRef = useRef<TextInput>(null);
    const [name, setName] = useState("");
    const [iconName, setIconName] = useState<string | null>(null);
    const [iconColor, setIconColor] = useState<string | null>(null);
    const [pickingIcon, setPickingIcon] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!visible) {
            if (mounted) close();
            return;
        }
        closingRef.current = false;
        setMounted(true);
        setName(edit?.name ?? "");
        setIconName(edit?.icon ?? null);
        setIconColor(edit?.color ?? null);
        opacity.value = withTiming(1, FADE);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);

    const finishClose = () => {
        if (!closingRef.current) return;
        setMounted(false);
        setName("");
        setIconName(null);
        setIconColor(null);
        setPickingIcon(false);
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
    // Older workspaces may have no icon; editing one doesn't force picking it
    const canCreate = trimmed.length > 0 && (!!edit || (!!iconName && !!iconColor)) && !saving;

    const saveEdit = async (current: NonNullable<Props["edit"]>) => {
        const nameChanged = trimmed !== current.name;
        const iconChanged = iconName !== (current.icon ?? null);
        const colorChanged = iconColor !== (current.color ?? null);
        if (!nameChanged && !iconChanged && !colorChanged) return close();
        if (nameChanged && doesWorkspaceExist(trimmed)) {
            Alert.alert("Workspace already exists", "Please enter a different name");
            return;
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        setSaving(true);
        try {
            if (nameChanged) await renameWorkspace(current.name, trimmed);
            if (iconChanged || colorChanged) {
                await updateWorkspaceIconColor(
                    trimmed,
                    iconChanged ? iconName : undefined,
                    colorChanged ? iconColor : undefined
                );
            }
            showToastable({
                title: "Workspace updated",
                status: "success",
                position: "top",
                swipeDirection: "up",
                duration: 2500,
                message: nameChanged ? `Renamed to "${trimmed}"` : `"${trimmed}" updated`,
                renderContent: (props) => <DefaultToast {...props} />,
            });
            close();
        } catch (err) {
            console.error(err);
            setSaving(false);
            Alert.alert("Error", "Failed to update workspace. Please try again.");
        }
    };

    const submit = async () => {
        if (!canCreate || closingRef.current) return;
        if (edit) return saveEdit(edit);
        if (doesWorkspaceExist(trimmed)) {
            Alert.alert("Workspace already exists", "Please enter a different name");
            return;
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        setSaving(true);
        try {
            const response = await createWorkspace(trimmed, iconName!, iconColor!);
            addWorkspace(trimmed, response, iconName!, iconColor!);
            setSelected(trimmed);
            close();
        } catch (err) {
            console.log(err);
            setSaving(false);
            Alert.alert("Error", "Failed to create workspace");
        }
    };

    const stackStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ translateY: (1 - opacity.value) * 16 }],
    }));

    if (!mounted) return null;

    const IconPreview: PhosphorComponent | null = iconName
        ? (((PhosphorIcons as any)[iconName] as PhosphorComponent) ?? null)
        : null;

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
                            accessibilityLabel={edit ? "Close without saving" : "Close without creating"}
                            style={[styles.round, { backgroundColor: STAGE.fillRaised }]}>
                            <X size={18} color={STAGE.text} weight="bold" />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.fill} pointerEvents="box-none" />

                    <View style={[styles.stack, { paddingBottom: 12 }]} pointerEvents="box-none">
                        <ThemedText type="caption" style={styles.caption}>
                            {edit ? "Edit workspace" : "New workspace"}
                        </ThemedText>
                        <View style={styles.titleRow}>
                            <TouchableOpacity
                                onPress={() => {
                                    Keyboard.dismiss();
                                    setPickingIcon(true);
                                }}
                                activeOpacity={0.7}
                                accessibilityRole="button"
                                accessibilityLabel={iconName ? "Change icon" : "Pick an icon"}
                                style={[styles.iconButton, { backgroundColor: STAGE.fillRaised }]}>
                                {IconPreview && iconColor ? (
                                    <IconPreview size={24} color={iconColor} weight="bold" />
                                ) : (
                                    <SquaresFour size={22} color={STAGE.muted} />
                                )}
                            </TouchableOpacity>
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
                        </View>
                        <View style={styles.bar}>
                            <ThemedText type="caption" style={[styles.caption, styles.fill]}>
                                {iconName || edit ? "Tap the icon to change it" : "Pick an icon so it stands out"}
                            </ThemedText>
                            <PrimaryButton
                                title={edit ? "Save" : "Create"}
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

            <IconPickerOverlay
                visible={pickingIcon}
                onClose={() => {
                    setPickingIcon(false);
                    inputRef.current?.focus();
                }}
                onSelect={(selected: string, color: string) => {
                    setIconName(selected);
                    setIconColor(color);
                }}
            />
        </Modal>
    );
}

const makeStyles = () =>
    StyleSheet.create({
        fill: { flex: 1 },
        topBar: { flexDirection: "row", paddingHorizontal: 16 },
        round: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
        stack: { paddingHorizontal: 16, gap: 12 },
        caption: { color: ON_DARK_MUTED, paddingHorizontal: 4 },
        titleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
        iconButton: { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
        // Drawn straight on the scrim, which is black in both themes
        input: {
            flex: 1,
            color: ON_DARK,
            fontSize: 24,
            fontWeight: 600,
            fontFamily: "Fraunces",
            letterSpacing: -1,
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

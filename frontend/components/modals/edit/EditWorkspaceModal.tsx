import { Alert, StyleSheet, TouchableOpacity, View } from "react-native";
import React, { useState } from "react";
import ThemedInput from "@/components/inputs/ThemedInput";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { ThemedText } from "@/components/ThemedText";
import Feather from "@expo/vector-icons/Feather";
import { useTasks } from "@/contexts/tasksContext";
import { useThemeColor } from "@/hooks/useThemeColor";
import { showToastable } from "react-native-toastable";
import DefaultToast from "@/components/ui/DefaultToast";
import { IconPickerOverlay } from "@/components/ui/IconPickerOverlay";
import * as PhosphorIcons from "phosphor-react-native";

type PhosphorComponent = React.ComponentType<{ size?: number; weight?: string; color?: string }>;

type Props = {
    hide: () => void;
    currentName: string;
    currentIcon?: string | null;
    currentColor?: string | null;
    onIconPickerVisibilityChange?: (open: boolean) => void;
};

const EditWorkspaceModal = ({ hide, currentName, currentIcon, currentColor, onIconPickerVisibilityChange }: Props) => {
    const ThemedColor = useThemeColor();
    const [name, setName] = useState(currentName);
    const [iconName, setIconName] = useState<string | null>(currentIcon ?? null);
    const [iconColor, setIconColor] = useState<string | null>(currentColor ?? null);
    const [showIconPicker, setShowIconPicker] = useState(false);
    const { doesWorkspaceExist, renameWorkspace, updateWorkspaceIconColor } = useTasks();

    const handleEditWorkspace = async () => {
        if (name.length === 0) {
            Alert.alert("Invalid Workspace Name", "Workspace name cannot be empty");
            return;
        }

        const nameChanged = name !== currentName;
        const iconChanged = iconName !== (currentIcon ?? null);
        const colorChanged = iconColor !== (currentColor ?? null);

        if (!nameChanged && !iconChanged && !colorChanged) {
            hide();
            return;
        }

        try {
            if (nameChanged) {
                if (doesWorkspaceExist(name)) {
                    Alert.alert("Workspace already exists", "Please enter a different name");
                    setName(currentName);
                    return;
                }
                await renameWorkspace(currentName, name);
            }

            if (iconChanged || colorChanged) {
                await updateWorkspaceIconColor(
                    nameChanged ? name : currentName,
                    iconChanged ? iconName : undefined,
                    colorChanged ? iconColor : undefined
                );
            }

            showToastable({
                title: "Workspace updated!",
                status: "success",
                position: "top",
                swipeDirection: "up",
                duration: 2500,
                message: nameChanged
                    ? `Workspace renamed to "${name}"`
                    : `Workspace "${name}" updated`,
                renderContent: (props) => <DefaultToast {...props} />,
            });

            hide();
        } catch (err) {
            console.log(err);
            showToastable({
                title: "Error",
                status: "danger",
                position: "top",
                message: "Failed to update workspace. Please try again.",
                renderContent: (props) => <DefaultToast {...props} />,
            });
            setName(currentName);
        }
    };

    const handleIconSelect = (selectedName: string, selectedColor: string) => {
        setIconName(selectedName);
        setIconColor(selectedColor);
    };

    const IconPreview: PhosphorComponent | null = iconName
        ? ((PhosphorIcons as any)[iconName] as PhosphorComponent) ?? null
        : null;

    return (
        <>
            <View style={[styles.container, { backgroundColor: ThemedColor.background }]}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={hide}>
                        <Feather name="arrow-left" size={20} color={ThemedColor.text} />
                    </TouchableOpacity>
                    <ThemedText type="subtitle" style={styles.title}>
                        Edit Workspace
                    </ThemedText>
                </View>
                <View style={{ gap: 16 }}>
                    <View style={styles.inputRow}>
                        <View style={{ flex: 1 }}>
                            <ThemedInput
                                autofocus
                                useBottomSheetInput={true}
                                placeHolder="Enter the Workspace Name"
                                onSubmit={handleEditWorkspace}
                                onChangeText={setName}
                                value={name}
                                setValue={setName}
                            />
                        </View>
                        <TouchableOpacity
                            style={[
                                styles.iconButton,
                                {
                                    backgroundColor: ThemedColor.lightened,
                                    borderColor: iconColor ?? ThemedColor.lightened,
                                },
                            ]}
                            onPress={() => { setShowIconPicker(true); onIconPickerVisibilityChange?.(true); }}
                            activeOpacity={0.75}>
                            {IconPreview && iconColor ? (
                                <IconPreview size={24} color={iconColor} weight="bold" />
                            ) : (
                                <Feather name="grid" size={20} color={ThemedColor.caption} />
                            )}
                            {iconName && (
                                <TouchableOpacity
                                    style={[
                                        styles.clearBadge,
                                        { backgroundColor: ThemedColor.background },
                                    ]}
                                    onPress={() => {
                                        setIconName(null);
                                        setIconColor(null);
                                    }}
                                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                                    <Feather name="x" size={9} color={ThemedColor.caption} />
                                </TouchableOpacity>
                            )}
                        </TouchableOpacity>
                    </View>

                    <View style={styles.buttonContainer}>
                        <PrimaryButton title="Update Workspace" onPress={handleEditWorkspace} />
                    </View>
                </View>
            </View>

            <IconPickerOverlay
                visible={showIconPicker}
                onClose={() => { setShowIconPicker(false); onIconPickerVisibilityChange?.(false); }}
                onSelect={(name, color) => { handleIconSelect(name, color); onIconPickerVisibilityChange?.(false); }}
            />
        </>
    );
};

export default EditWorkspaceModal;

const styles = StyleSheet.create({
    container: {
        gap: 12,
        flexDirection: "column",
        marginTop: 16,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
    },
    title: {
        flex: 1,
        textAlign: "center",
        marginRight: 40,
    },
    buttonContainer: {
        width: "100%",
        alignItems: "center",
    },
    inputRow: {
        flexDirection: "row",
        alignItems: "stretch",
        gap: 8,
    },
    iconButton: {
        width: 52,
        borderRadius: 12,
        borderWidth: 1.5,
        alignItems: "center",
        justifyContent: "center",
    },
    clearBadge: {
        position: "absolute",
        top: -7,
        right: -7,
        width: 16,
        height: 16,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "rgba(128,128,128,0.2)",
    },
});

import { Alert, StyleSheet, TouchableOpacity, View } from "react-native";
import React, { useState } from "react";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { ThemedText } from "@/components/ThemedText";
import Feather from "@expo/vector-icons/Feather";
import { useTasks } from "@/contexts/tasksContext";
import { useThemeColor } from "@/hooks/useThemeColor";
import { createWorkspace } from "../../../api/workspace";
import { IconPickerOverlay } from "@/components/ui/IconPickerOverlay";
import * as PhosphorIcons from "phosphor-react-native";

type PhosphorComponent = React.ComponentType<{ size?: number; weight?: string; color?: string }>;

type Props = {
    hide: () => void;
    onIconPickerVisibilityChange?: (open: boolean) => void;
};

const NewWorkspace = ({ hide, onIconPickerVisibilityChange }: Props) => {
    const ThemedColor = useThemeColor();
    const [name, setName] = useState("");
    const [iconName, setIconName] = useState<string | null>(null);
    const [iconColor, setIconColor] = useState<string | null>(null);
    const [showIconPicker, setShowIconPicker] = useState(false);
    const { addWorkspace, doesWorkspaceExist, setSelected } = useTasks();

    const handleCreateWorkspace = async () => {
        if (name.length === 0) {
            Alert.alert("Invalid Workspace Name", "Workspace name cannot be empty");
            return;
        }
        if (!iconName || !iconColor) {
            Alert.alert("Pick an icon", "Choose an icon so your workspace stands out.");
            return;
        }
        try {
            if (doesWorkspaceExist(name)) {
                Alert.alert("Workspace already exists", "Please enter a different name");
                setName("");
                return;
            }
            const response = await createWorkspace(name, iconName, iconColor);
            addWorkspace(name, response, iconName, iconColor);
            setSelected(name);
            hide();
        } catch (err) {
            console.log(err);
            Alert.alert("Error", "Failed to create workspace");
            setName("");
        }
    };

    const handleIconSelect = (selectedIconName: string, color: string) => {
        setIconName(selectedIconName);
        setIconColor(color);
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
                        New Workspace
                    </ThemedText>
                </View>
                <View style={{ gap: 16 }}>
                    {/* Name input + icon button inline */}
                    {/* Icon picker + name field share one pill */}
                    <View style={[styles.combinedInput, { backgroundColor: ThemedColor.lightened, borderColor: ThemedColor.lightened }]}>
                        <TouchableOpacity
                            style={styles.iconInline}
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
                        <BottomSheetTextInput
                            autoFocus
                            placeholder="Enter workspace name"
                            placeholderTextColor={ThemedColor.caption}
                            onSubmitEditing={handleCreateWorkspace}
                            onChangeText={setName}
                            value={name}
                            style={[styles.combinedTextInput, { color: ThemedColor.text }]}
                        />
                    </View>

                    {!iconName && (
                        <ThemedText type="caption" style={{ color: ThemedColor.caption }}>
                            Tap the icon to pick one — it's required.
                        </ThemedText>
                    )}

                    <View style={styles.buttonContainer}>
                        <PrimaryButton
                            title="Create Workspace"
                            onPress={handleCreateWorkspace}
                            disabled={name.length === 0 || !iconName}
                        />
                    </View>
                </View>
            </View>

            <IconPickerOverlay
                visible={showIconPicker}
                onClose={() => { setShowIconPicker(false); onIconPickerVisibilityChange?.(false); }}
                onSelect={handleIconSelect}
            />
        </>
    );
};

export default NewWorkspace;

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
    combinedInput: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 12,
        borderWidth: 1,
        paddingLeft: 6,
        paddingRight: 12,
    },
    iconInline: {
        width: 44,
        height: 52,
        alignItems: "center",
        justifyContent: "center",
    },
    combinedTextInput: {
        flex: 1,
        fontSize: 16,
        fontFamily: "OutfitLight",
        paddingVertical: 16,
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

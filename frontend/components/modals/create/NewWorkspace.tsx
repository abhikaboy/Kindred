import { Alert, StyleSheet, TouchableOpacity, View } from "react-native";
import React, { useState } from "react";
import ThemedInput from "@/components/inputs/ThemedInput";
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
};

const NewWorkspace = ({ hide }: Props) => {
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
        try {
            if (doesWorkspaceExist(name)) {
                Alert.alert("Workspace already exists", "Please enter a different name");
                setName("");
                return;
            }
            const response = await createWorkspace(name, iconName, iconColor);
            addWorkspace(name, response);
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
                    <View style={styles.inputRow}>
                        <View style={{ flex: 1 }}>
                            <ThemedInput
                                useBottomSheetInput={true}
                                autofocus
                                placeHolder="Enter workspace name"
                                onSubmit={handleCreateWorkspace}
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
                            onPress={() => setShowIconPicker(true)}
                            activeOpacity={0.75}>
                            {IconPreview && iconColor ? (
                                <IconPreview size={22} color={iconColor} weight="bold" />
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
                        <PrimaryButton title="Create Workspace" onPress={handleCreateWorkspace} />
                    </View>
                </View>
            </View>

            <IconPickerOverlay
                visible={showIconPicker}
                onClose={() => setShowIconPicker(false)}
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
        gap: 16,
    },
    title: {
        textAlign: "center",
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

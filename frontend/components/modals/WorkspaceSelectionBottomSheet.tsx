import React, { useRef, useCallback, useMemo, useState } from "react";
import { StyleSheet, View, TouchableOpacity, ScrollView } from "react-native";
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import { ThemedText } from "@/components/ThemedText";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { useThemeColor } from "@/hooks/useThemeColor";
import { createWorkspace } from "@/api/workspace";
import { useTasks } from "@/contexts/tasksContext";
import * as PhosphorIcons from "phosphor-react-native";
import { showToast } from "@/utils/showToast";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/hooks/useAuth";

interface WorkspaceSelectionBottomSheetProps {
    isVisible: boolean;
    onClose: () => void;
    onComplete: () => void;
}

type WorkspaceOption = { name: string; icon: string; color: string };

// Six broad starters, each with a fun icon + color (no emoji).
const WORKSPACE_OPTIONS: WorkspaceOption[] = [
    { name: "Work", icon: "Briefcase", color: "#4E7BEF" },
    { name: "School", icon: "GraduationCap", color: "#A855F7" },
    { name: "Fitness", icon: "Barbell", color: "#F97316" },
    { name: "Finance", icon: "Wallet", color: "#10B981" },
    { name: "Household", icon: "House", color: "#EC4899" },
    { name: "Hobbies", icon: "Palette", color: "#EAB308" },
];

export default function WorkspaceSelectionBottomSheet({
    isVisible,
    onClose,
    onComplete,
}: WorkspaceSelectionBottomSheetProps) {
    const ThemedColor = useThemeColor();
    const styles = stylesheet(ThemedColor);
    const { addWorkspace, fetchWorkspaces } = useTasks();
    const { user } = useAuth();

    const [selectedWorkspaces, setSelectedWorkspaces] = useState<string[]>([]);
    const [isCreating, setIsCreating] = useState(false);

    // ref
    const bottomSheetModalRef = useRef<BottomSheetModal>(null);

    // variables
    const snapPoints = useMemo(() => ["85%"], []);

    // callbacks
    const handlePresentModalPress = useCallback(() => {
        bottomSheetModalRef.current?.present();
    }, []);

    const handleDismiss = useCallback(() => {
        bottomSheetModalRef.current?.dismiss();
        onClose();
    }, [onClose]);

    const markQuickSetupComplete = useCallback(async () => {
        if (!user?._id) return;
        try {
            const key = `${user._id}-quicksetup`;
            await AsyncStorage.setItem(key, "true");
        } catch (error) {
            console.error("Error saving quick setup status:", error);
        }
    }, [user]);

    const toggleWorkspace = useCallback((workspaceName: string) => {
        setSelectedWorkspaces((prev) => {
            if (prev.includes(workspaceName)) {
                return prev.filter((name) => name !== workspaceName);
            } else {
                return [...prev, workspaceName];
            }
        });
    }, []);

    const handleContinue = useCallback(async () => {
        if (selectedWorkspaces.length === 0) {
            showToast("Please select at least one workspace", "warning");
            return;
        }

        setIsCreating(true);
        try {
            // Create all selected workspaces in parallel (silent mode to avoid individual toasts)
            const createPromises = selectedWorkspaces.map(async (workspaceName) => {
                try {
                    const opt = WORKSPACE_OPTIONS.find((o) => o.name === workspaceName);
                    const response = await createWorkspace(workspaceName, opt?.icon, opt?.color);
                    // Convert CategoryDocument to Categories type
                    const categoryForWorkspace = {
                        id: response.id,
                        name: response.name,
                        tasks: (response.tasks ?? []).map(task => ({
                            ...task,
                            recurDetails: task.recurDetails || { every: 0 }
                        }))
                    };
                    addWorkspace(workspaceName, categoryForWorkspace as any, opt?.icon, opt?.color);
                    return { success: true, workspaceName };
                } catch (error) {
                    console.error(`Failed to create workspace ${workspaceName}:`, error);
                    return { success: false, workspaceName };
                }
            });

            const results = await Promise.all(createPromises);

            // Check if all workspaces were created successfully
            const successCount = results.filter(r => r.success).length;
            const failCount = results.length - successCount;

            if (successCount > 0) {
                showToast(`Successfully created ${successCount} workspace${successCount > 1 ? 's' : ''}!`, "success");
            }

            if (failCount > 0) {
                showToast(`Failed to create ${failCount} workspace${failCount > 1 ? 's' : ''}`, "danger");
            }

            // Refresh workspaces list
            await fetchWorkspaces();

            // Mark quick setup as complete
            await markQuickSetupComplete();

            // Close the modal and call completion handler
            handleDismiss();
            onComplete();
        } catch (error) {
            console.error("Error creating workspaces:", error);
            showToast("Failed to create workspaces. Please try again.", "danger");
        } finally {
            setIsCreating(false);
        }
    }, [selectedWorkspaces, addWorkspace, fetchWorkspaces, handleDismiss, onComplete, markQuickSetupComplete]);

    const handleSkip = useCallback(async () => {
        // Mark quick setup as complete even when skipping
        await markQuickSetupComplete();
        handleDismiss();
        onComplete();
    }, [handleDismiss, onComplete, markQuickSetupComplete]);

    const renderBackdrop = useCallback(
        (props: any) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />,
        []
    );

    // Show modal when isVisible changes
    React.useEffect(() => {
        if (isVisible) {
            handlePresentModalPress();
        } else {
            handleDismiss();
        }
    }, [isVisible, handlePresentModalPress, handleDismiss]);

    const isSelected = useCallback((workspaceName: string) => {
        return selectedWorkspaces.includes(workspaceName);
    }, [selectedWorkspaces]);

    return (
        <BottomSheetModal
            ref={bottomSheetModalRef}
            index={0}
            snapPoints={snapPoints}
            backdropComponent={renderBackdrop}
            backgroundStyle={styles.bottomSheetBackground}
            handleIndicatorStyle={styles.handleIndicator}
            onDismiss={handleDismiss}>
            <BottomSheetView style={styles.container}>
                {/* Title */}
                <View style={styles.titleContainer}>
                    <ThemedText style={styles.title}>Let's get started with a few workspaces</ThemedText>
                    <ThemedText style={styles.subtitle}>
                        Select which workspaces you'd like to start off with
                    </ThemedText>
                </View>

                {/* Workspace Grid */}
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollViewContent}
                    showsVerticalScrollIndicator={false}>
                    <View style={styles.workspaceGrid}>
                        {WORKSPACE_OPTIONS.map((workspace) => {
                            const Icon = (PhosphorIcons as any)[workspace.icon];
                            const selected = isSelected(workspace.name);
                            return (
                                <TouchableOpacity
                                    key={workspace.name}
                                    style={[
                                        styles.workspaceCard,
                                        { backgroundColor: workspace.color + "1A" },
                                        selected && { borderColor: workspace.color, backgroundColor: workspace.color + "2E" },
                                    ]}
                                    onPress={() => toggleWorkspace(workspace.name)}
                                    activeOpacity={0.7}>
                                    <View style={styles.cardRow}>
                                        {Icon && <Icon size={22} color={workspace.color} weight="fill" />}
                                        <ThemedText style={styles.workspaceText}>{workspace.name}</ThemedText>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </ScrollView>

                {/* Buttons */}
                <View style={styles.buttonContainer}>
                    <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
                        <ThemedText style={styles.skipText}>Skip for now</ThemedText>
                    </TouchableOpacity>
                    <PrimaryButton
                        title={isCreating ? "Creating..." : "Continue"}
                        onPress={handleContinue}
                        style={styles.button}
                        disabled={isCreating}
                    />
                </View>
            </BottomSheetView>
        </BottomSheetModal>
    );
}

const stylesheet = (ThemedColor: any) =>
    StyleSheet.create({
        bottomSheetBackground: {
            backgroundColor: ThemedColor.background,
            borderRadius: 32,
        },
        handleIndicator: {
            backgroundColor: ThemedColor.tertiary,
            width: 40,
            height: 4,
        },
        container: {
            flex: 1,
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: 32,
        },
        titleContainer: {
            marginBottom: 24,
            gap: 12,
        },
        title: {
            fontSize: 32,
            fontWeight: "600",
            color: ThemedColor.text,
            fontFamily: "Fraunces",
            letterSpacing: -1.28,
            lineHeight: 38.4,
        },
        subtitle: {
            fontSize: 16,
            color: ThemedColor.text,
            fontFamily: "Outfit",
            lineHeight: 24,
        },
        scrollView: {
            maxHeight: 360,
            marginBottom: 16,
        },
        scrollViewContent: {
            paddingBottom: 8,
        },
        workspaceGrid: {
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 9,
        },
        workspaceCard: {
            backgroundColor: ThemedColor.lightened,
            borderRadius: 12,
            paddingHorizontal: 20,
            paddingVertical: 20,
            minHeight: 59,
            justifyContent: "center",
            width: "48%",
            borderWidth: 1,
            borderColor: "transparent",
            shadowColor: "#000",
            shadowOffset: {
                width: 0,
                height: 1,
            },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 2,
        },
        workspaceCardSelected: {
            borderColor: ThemedColor.primary || "#854dff",
            borderWidth: 1,
        },
        cardRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
        },
        workspaceText: {
            fontSize: 16,
            color: ThemedColor.text,
            fontFamily: "Outfit",
        },
        buttonContainer: {
            gap: 12,
        },
        skipButton: {
            paddingVertical: 12,
            alignItems: "center",
        },
        skipText: {
            fontSize: 16,
            color: ThemedColor.caption,
            fontFamily: "Outfit",
        },
        button: {
            borderRadius: 12,
            shadowColor: "#000",
            shadowOffset: {
                width: 0,
                height: 4,
            },
            shadowOpacity: 0.25,
            shadowRadius: 4,
            elevation: 4,
        },
    });

import React, { useRef, useCallback, useMemo, useState } from "react";
import { StyleSheet, View, TouchableOpacity, ScrollView } from "react-native";
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import { ThemedText } from "@/components/ThemedText";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { useThemeColor } from "@/hooks/useThemeColor";
import { createCategory } from "@/api/category";
import { useTasks } from "@/contexts/tasksContext";
import { showToast } from "@/utils/showToast";

interface WorkspaceOption {
    name: string;
    emoji: string;
}

interface WorkspaceSelectionBottomSheetProps {
    isVisible: boolean;
    onClose: () => void;
    onComplete: () => void;
}

const WORKSPACE_OPTIONS: WorkspaceOption[] = [
    { name: "Classes", emoji: "📚" },
    { name: "School", emoji: "📚" },
    { name: "Household", emoji: "🏠" },
    { name: "Daily", emoji: "☀" },
    { name: "Work", emoji: "🧳" },
    { name: "Hygiene", emoji: "🧼" },
    { name: "Internship Applications", emoji: "💼" },
    { name: "Friendships", emoji: "🫰" },
    { name: "Wishlist", emoji: "⭐" },
    { name: "Family", emoji: "🫶" },
    { name: "Fitness", emoji: "💪" },
    { name: "Health", emoji: "❤️" },
    { name: "Hobbies", emoji: "🎨" },
    { name: "Reading", emoji: "📖" },
    { name: "Learning", emoji: "🎓" },
    { name: "Cooking", emoji: "👨‍🍳" },
    { name: "Travel", emoji: "✈️" },
    { name: "Finance", emoji: "💰" },
    { name: "Side Projects", emoji: "🚀" },
    { name: "Music", emoji: "🎵" },
    { name: "Sports", emoji: "⚽" },
    { name: "Self Care", emoji: "🧘" },
    { name: "Career", emoji: "📊" },
    { name: "Social Life", emoji: "🎉" },
    { name: "Volunteering", emoji: "🤝" },
    { name: "Gaming", emoji: "🎮" },
    { name: "Pet Care", emoji: "🐾" },
    { name: "Garden", emoji: "🌱" },
    { name: "Shopping", emoji: "🛍️" },
    { name: "Events", emoji: "📅" },
];

export default function WorkspaceSelectionBottomSheet({
    isVisible,
    onClose,
    onComplete,
}: WorkspaceSelectionBottomSheetProps) {
    const ThemedColor = useThemeColor();
    const styles = stylesheet(ThemedColor);
    const { addWorkspace, fetchWorkspaces } = useTasks();
    
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
                    // Find the emoji for this workspace
                    const workspaceOption = WORKSPACE_OPTIONS.find(opt => opt.name === workspaceName);
                    const workspaceNameWithEmoji = workspaceOption ? `${workspaceOption.emoji} ${workspaceName}` : workspaceName;
                    
                    const response = await createCategory("!-proxy-!", workspaceNameWithEmoji, true);
                    // Convert CategoryDocument to Categories type
                    const categoryForWorkspace = {
                        id: response.id,
                        name: response.name,
                        tasks: response.tasks.map(task => ({
                            ...task,
                            recurDetails: task.recurDetails || { every: 0 }
                        }))
                    };
                    addWorkspace(workspaceNameWithEmoji, categoryForWorkspace as any);
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
            
            // Close the modal and call completion handler
            handleDismiss();
            onComplete();
        } catch (error) {
            console.error("Error creating workspaces:", error);
            showToast("Failed to create workspaces. Please try again.", "danger");
        } finally {
            setIsCreating(false);
        }
    }, [selectedWorkspaces, addWorkspace, fetchWorkspaces, handleDismiss, onComplete]);

    const handleSkip = useCallback(() => {
        handleDismiss();
        onComplete();
    }, [handleDismiss, onComplete]);

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
                        {WORKSPACE_OPTIONS.map((workspace) => (
                            <TouchableOpacity
                                key={workspace.name}
                                style={[
                                    styles.workspaceCard,
                                    isSelected(workspace.name) && styles.workspaceCardSelected,
                                ]}
                                onPress={() => toggleWorkspace(workspace.name)}
                                activeOpacity={0.7}>
                                <ThemedText style={styles.workspaceText}>
                                    {workspace.emoji} {workspace.name}
                                </ThemedText>
                            </TouchableOpacity>
                        ))}
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


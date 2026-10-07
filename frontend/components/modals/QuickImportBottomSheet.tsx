import React, { useRef, useCallback, useMemo } from "react";
import { StyleSheet, View, TouchableOpacity } from "react-native";
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";

interface QuickImportBottomSheetProps {
    isVisible: boolean;
    onClose: () => void;
}

export default function QuickImportBottomSheet({ isVisible, onClose }: QuickImportBottomSheetProps) {
    const ThemedColor = useThemeColor();
    const styles = stylesheet(ThemedColor);

    // ref
    const bottomSheetModalRef = useRef<BottomSheetModal>(null);

    // variables
    const snapPoints = useMemo(() => ["65%"], []);

    // callbacks
    const handlePresentModalPress = useCallback(() => {
        bottomSheetModalRef.current?.present();
    }, []);

    const handleDismiss = useCallback(() => {
        bottomSheetModalRef.current?.dismiss();
        onClose();
    }, [onClose]);

    const handlePhotoImport = useCallback(() => {
        handleDismiss();
        // Navigate to camera view or photo picker
        router.push("/(logged-in)/posting/cameraview");
    }, [handleDismiss]);

    const handleVoiceImport = useCallback(() => {
        handleDismiss();
        // Navigate to voice import screen
        router.push("/(logged-in)/(tabs)/(task)/voice");
    }, [handleDismiss]);

    const handleTextImport = useCallback(() => {
        handleDismiss();
        // Navigate to text import screen
        router.push("/(logged-in)/(tabs)/(task)/text-dump");
    }, [handleDismiss]);

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
                    <ThemedText type="fancyFrauncesHeading" style={styles.title}>
                        Quick Import
                    </ThemedText>
                </View>

                {/* Import Options */}
                <View style={styles.optionsContainer}>
                    {/* Photo Import */}
                    <TouchableOpacity
                        style={styles.optionCard}
                        onPress={handlePhotoImport}
                        activeOpacity={0.7}>
                        <Ionicons name="camera" size={32} color={ThemedColor.text} style={styles.optionIcon} />
                        <View style={styles.optionTextContainer}>
                            <ThemedText type="defaultSemiBold" style={styles.optionTitle}>
                                Photo Import
                            </ThemedText>
                            <ThemedText type="caption" style={styles.optionDescription}>
                                Submit a screenshot from another app, or a picture of a list of tasks to quickly
                                import them into Kindred
                            </ThemedText>
                        </View>
                    </TouchableOpacity>

                    {/* Voice Import */}
                    <TouchableOpacity
                        style={styles.optionCard}
                        onPress={handleVoiceImport}
                        activeOpacity={0.7}>
                        <Ionicons name="mic" size={32} color={ThemedColor.text} style={styles.optionIcon} />
                        <View style={styles.optionTextContainer}>
                            <ThemedText type="defaultSemiBold" style={styles.optionTitle}>
                                Voice Import
                            </ThemedText>
                            <ThemedText type="caption" style={styles.optionDescription}>
                                Say aloud the tasks you wish to feed into Kindred, broken up into categories for you,
                                without any taps or swipes!
                            </ThemedText>
                            <ThemedText type="caption" style={[styles.optionDescription, styles.exampleText]}>
                                Example: "I have pilates every Tuesday at 8AM, and I want to make breakfast before
                                that by 7:15 AM"
                            </ThemedText>
                        </View>
                    </TouchableOpacity>

                    {/* Text Import */}
                    <TouchableOpacity
                        style={styles.optionCard}
                        onPress={handleTextImport}
                        activeOpacity={0.7}>
                        <Ionicons name="create-outline" size={32} color={ThemedColor.text} style={styles.optionIcon} />
                        <View style={styles.optionTextContainer}>
                            <ThemedText type="defaultSemiBold" style={styles.optionTitle}>
                                Text Import
                            </ThemedText>
                            <ThemedText type="caption" style={styles.optionDescription}>
                                Type out your thoughts and tasks freely, and let Kindred organize them into actionable
                                items for you!
                            </ThemedText>
                        </View>
                    </TouchableOpacity>
                </View>
            </BottomSheetView>
        </BottomSheetModal>
    );
}

const stylesheet = (ThemedColor: any) =>
    StyleSheet.create({
        bottomSheetBackground: {
            backgroundColor: ThemedColor.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
        },
        handleIndicator: {
            backgroundColor: ThemedColor.tertiary,
            width: 44,
            height: 4,
        },
        container: {
            flex: 1,
            paddingHorizontal: HORIZONTAL_PADDING,
            paddingTop: 31,
            paddingBottom: 32,
            gap: 44,
        },
        titleContainer: {
            paddingHorizontal: 0,
            paddingVertical: 4,
        },
        title: {
            fontSize: 32,
            fontWeight: "600",
            color: ThemedColor.text,
            fontFamily: "Fraunces",
            letterSpacing: -1,
        },
        optionsContainer: {
            gap: 24,
        },
        optionCard: {
            backgroundColor: ThemedColor.background,
            borderRadius: 12,
            padding: 20,
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 10,
            shadowColor: "#000",
            shadowOffset: {
                width: 0,
                height: 2,
            },
            shadowOpacity: 0.15,
            shadowRadius: 4,
            elevation: 3,
        },
        optionIcon: {
            flexShrink: 0,
        },
        optionTextContainer: {
            flex: 1,
            gap: 10,
            justifyContent: "center",
        },
        optionTitle: {
            fontSize: 16,
            color: ThemedColor.text,
            fontFamily: "Outfit",
        },
        optionDescription: {
            fontSize: 14,
            color: ThemedColor.caption,
            fontFamily: "Outfit",
            lineHeight: 20,
        },
        exampleText: {
            fontStyle: "italic",
        },
    });


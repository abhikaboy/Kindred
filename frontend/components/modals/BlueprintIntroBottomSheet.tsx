import React, { useRef, useCallback, useMemo } from "react";
import { StyleSheet, View, Image } from "react-native";
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { useThemeColor } from "@/hooks/useThemeColor";

interface BlueprintIntroBottomSheetProps {
    isVisible: boolean;
    onClose: () => void;
    onBuildBlueprint: () => void;
}

export default function BlueprintIntroBottomSheet({
    isVisible,
    onClose,
    onBuildBlueprint,
}: BlueprintIntroBottomSheetProps) {
    const ThemedColor = useThemeColor();
    const styles = stylesheet(ThemedColor);

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

    const handleBuildBlueprint = useCallback(() => {
        handleDismiss();
        onBuildBlueprint();
    }, [handleDismiss, onBuildBlueprint]);

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
                    <ThemedText style={styles.title}>Introducing Blueprints</ThemedText>
                </View>

                {/* Image Container */}
                <View style={styles.imageContainer}>
                    <View style={styles.imageWrapper}>
                        <Image
                            source={require("@/assets/images/blueprintReplacement.png")}
                            style={styles.image}
                            resizeMode="cover"
                        />
                    </View>
                </View>

                {/* Description */}
                <View style={styles.descriptionContainer}>
                    <ThemedText type="subtitle_subtle">COPY HABITS & LISTS </ThemedText>
                    <ThemedText style={styles.description}>
                        Through Blueprints, you can copy the habits/todo lists of others or build out those habits and
                        todolists yourself. {`\n`}
                    </ThemedText>
                    <ThemedText style={styles.description}>
                        Blueprints are a public todo list that others can subscribe to and post to.
                    </ThemedText>
                </View>

                {/* Additional Info */}
                <View style={styles.infoContainer}>
                    <ThemedText type="subtitle_subtle">BUILD COMMUNITIES </ThemedText>
                    <ThemedText style={styles.infoText}>
                        By building a blueprint, you can also build a community where others are completing similar
                        tasks and hold yourself accountable
                    </ThemedText>
                </View>

                {/* Button */}
                <PrimaryButton title="Build a Blueprint" onPress={handleBuildBlueprint} style={styles.button} />
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
            paddingTop: 32,
        },
        titleContainer: {
            marginBottom: 24,
        },
        title: {
            fontSize: 24,
            fontWeight: "600",
            color: ThemedColor.text,
            fontFamily: "Fraunces",
            letterSpacing: -1,
            textAlign: "center",
        },
        imageContainer: {
            marginBottom: 32,
        },
        imageWrapper: {
            backgroundColor: ThemedColor.tertiary,
            borderRadius: 4,
            height: 152,
            overflow: "hidden",
            position: "relative",
        },
        image: {
            width: "100%",
            height: 180,
            position: "absolute",
            top: -24,
        },
        imageOverlay: {
            position: "absolute",
            top: 51,
            left: 0,
            right: 0,
            alignItems: "center",
        },
        imageText: {
            fontSize: 12,
            color: ThemedColor.text,
            fontFamily: "Outfit",
        },
        descriptionContainer: {
            marginBottom: 24,
        },
        description: {
            fontSize: 16,
            color: ThemedColor.text,
            fontFamily: "Outfit",
            lineHeight: 24,
        },
        infoContainer: {
            marginBottom: 32,
        },
        infoText: {
            fontSize: 16,
            color: ThemedColor.text,
            fontFamily: "Outfit",
            lineHeight: 24,
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
            marginBottom: 48,
            elevation: 4,
        },
    });

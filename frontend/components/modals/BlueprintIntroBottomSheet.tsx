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
    const snapPoints = useMemo(() => ["80%"], []);

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
                    <ThemedText style={styles.subtitle}>Shareable to-do lists for everyone</ThemedText>
                </View>

                {/* Image Container */}
                <View style={styles.imageContainer}>
                    <View style={styles.imageWrapper}>
                        <Image
                            source={require("@/assets/images/together.png")}
                            style={styles.image}
                            resizeMode="cover"
                        />
                    </View>
                </View>

                {/* Description */}
                <View style={styles.descriptionContainer}>
                    <ThemedText type="subtitle_subtle">WHAT ARE BLUEPRINTS?</ThemedText>
                    <ThemedText style={styles.description}>
                        Blueprints are <ThemedText style={styles.bold}>static, shareable to-do lists</ThemedText> that anyone can subscribe to and use as their own!
                    </ThemedText>
                </View>

                {/* Features */}
                <View style={styles.featuresContainer}>
                    <View style={styles.featureRow}>
                        <ThemedText style={styles.bullet}>•</ThemedText>
                        <ThemedText style={styles.featureText}>Subscribe to others' lists and make them yours</ThemedText>
                    </View>
                    <View style={styles.featureRow}>
                        <ThemedText style={styles.bullet}>•</ThemedText>
                        <ThemedText style={styles.featureText}>Create your own and share with the community</ThemedText>
                    </View>
                    <View style={styles.featureRow}>
                        <ThemedText style={styles.bullet}>•</ThemedText>
                        <ThemedText style={styles.featureText}>Build accountability through shared goals</ThemedText>
                    </View>
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
            paddingHorizontal: 24,
            paddingTop: 24,
        },
        titleContainer: {
            marginBottom: 20,
            alignItems: "center",
        },
        title: {
            fontSize: 28,
            fontWeight: "700",
            color: ThemedColor.text,
            fontFamily: "Fraunces",
            letterSpacing: -1,
            textAlign: "center",
            marginBottom: 4,
        },
        subtitle: {
            fontSize: 16,
            color: ThemedColor.caption,
            fontFamily: "Outfit",
            textAlign: "center",
        },
        imageContainer: {
            marginBottom: 0,
            alignItems: "center",
        },
        imageWrapper: {
            width: "100%",
            height: 180,
            alignItems: "center",
            justifyContent: "center",
        },
        image: {
            width: "70%",
            height: "70%",
        },
        descriptionContainer: {
            marginBottom: 20,
        },
        description: {
            fontSize: 15,
            color: ThemedColor.text,
            fontFamily: "Outfit",
            lineHeight: 22,
            marginTop: 8,
        },
        bold: {
            fontWeight: "600",
            color: ThemedColor.primary,
        },
        featuresContainer: {
            marginBottom: 32,
            gap: 8,
        },
        featureRow: {
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 8,
        },
        bullet: {
            fontSize: 18,
            color: ThemedColor.primary,
            fontWeight: "bold",
            marginTop: 2,
        },
        featureText: {
            flex: 1,
            fontSize: 15,
            color: ThemedColor.text,
            fontFamily: "Outfit",
            lineHeight: 22,
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
            marginBottom: 24,
            elevation: 4,
        },
    });

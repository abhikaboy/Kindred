import React, { useState } from "react";
import { View, StyleSheet, Image, TouchableOpacity, Alert, Dimensions } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import ThemedInput from "@/components/inputs/ThemedInput";
import { BlueprintData } from "@/app/(logged-in)/blueprint/_layout";
import * as ImagePicker from "expo-image-picker";
import { uploadBlueprintBanner, getMimeTypeFromUri } from "@/api/upload";
import { Ionicons } from "@expo/vector-icons";

type Props = {
    data: BlueprintData;
    onUpdate: (updates: Partial<BlueprintData>) => void;
};

const Details = ({ data, onUpdate }: Props) => {
    const ThemedColor = useThemeColor();
    const styles = createStyles(ThemedColor);
    const [isUploading, setIsUploading] = useState(false);
    const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);

    const handleDurationChange = (duration: string) => {
        onUpdate({ duration });
    };

    const handleCategoryChange = (category: string) => {
        onUpdate({ category });
    };

    const pickImage = async () => {
        try {
            // Request permissions
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

            if (status !== "granted") {
                Alert.alert("Permission Required", "Sorry, we need camera roll permissions to select a banner image!");
                return;
            }

            // Launch image picker
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [16, 9], // Banner aspect ratio
                quality: 0.8,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const imageUri = result.assets[0].uri;
                setSelectedImageUri(imageUri);
                await uploadBannerImage(imageUri);
            }
        } catch (error) {
            console.error("Image picker error:", error);
            Alert.alert("Error", "Failed to pick image. Please try again.");
        }
    };

    const uploadBannerImage = async (imageUri: string) => {
        try {
            setIsUploading(true);

            // Generate a temporary ID for the blueprint (since it doesn't exist yet)
            const tempBlueprintId = "temp_" + Date.now();
            const fileType = getMimeTypeFromUri(imageUri);

            console.log("Uploading banner image...");
            const bannerImageUrl = await uploadBlueprintBanner(tempBlueprintId, imageUri, fileType);
            console.log("Banner image uploaded:", bannerImageUrl);

            // Update the blueprint data with the banner image URL
            onUpdate({ bannerImage: bannerImageUrl });
        } catch (error) {
            console.error("Banner image upload failed:", error);
            Alert.alert("Upload Failed", "Failed to upload banner image. Please try again.");
            setSelectedImageUri(null);
        } finally {
            setIsUploading(false);
        }
    };

    const removeBannerImage = () => {
        setSelectedImageUri(null);
        onUpdate({ bannerImage: "" });
    };

    const displayImage = selectedImageUri || data.bannerImage;

    return (
        <View style={styles.stepContent}>
            <View style={styles.fieldContainer}>
                <ThemedText type="lightBody" style={styles.fieldLabel}>
                    Frequency or Duration
                </ThemedText>
                <ThemedInput
                    value={data.duration}
                    setValue={handleDurationChange}
                    placeHolder="Enter Frequency or Duration of blueprint"
                />
            </View>

            <View style={styles.fieldContainer}>
                <ThemedText type="lightBody" style={styles.fieldLabel}>
                    Category
                </ThemedText>
                <ThemedInput
                    value={data.category}
                    setValue={handleCategoryChange}
                    placeHolder="Enter a category of blueprint"
                />
            </View>

            <View style={styles.fieldContainer}>
                <ThemedText type="lightBody" style={styles.fieldLabel}>
                    Banner Image
                </ThemedText>

                {displayImage ? (
                    <View style={styles.imageContainer}>
                        <Image source={{ uri: displayImage }} style={styles.bannerImage} resizeMode="cover" />
                        <View style={styles.imageOverlay}>
                            <TouchableOpacity
                                onPress={pickImage}
                                disabled={isUploading}
                                style={[styles.overlayButton, isUploading && styles.disabledButton]}>
                                <Ionicons name="camera" size={24} color={ThemedColor.background} />
                                <ThemedText type="lightBody" style={styles.overlayButtonText}>
                                    {isUploading ? "Uploading..." : "Change Image"}
                                </ThemedText>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={removeBannerImage}
                                disabled={isUploading}
                                style={[styles.removeButton, isUploading && styles.disabledButton]}>
                                <Ionicons name="trash" size={20} color="#FF4444" />
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <TouchableOpacity
                        onPress={pickImage}
                        disabled={isUploading}
                        style={[styles.uploadButton, isUploading && styles.disabledButton]}>
                        <Ionicons name="add" size={32} color={ThemedColor.text} />
                        <ThemedText type="lightBody" style={styles.uploadButtonText}>
                            {isUploading ? "Uploading..." : "Add Banner Image"}
                        </ThemedText>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
};

const createStyles = (ThemedColor: any) =>
    StyleSheet.create({
        stepContent: {
            gap: 32,
        },
        fieldContainer: {
            gap: 12,
        },
        fieldLabel: {
            fontSize: 16,
            fontWeight: "500",
            color: ThemedColor.text,
        },
        uploadButton: {
            height: 120,
            borderWidth: 2,
            borderColor: ThemedColor.tertiary,
            borderStyle: "dashed",
            borderRadius: 12,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: ThemedColor.lightened,
        },
        disabledButton: {
            opacity: 0.5,
        },
        uploadButtonText: {
            marginTop: 8,
            color: ThemedColor.text,
            fontSize: 14,
        },
        imageContainer: {
            position: "relative",
            borderRadius: 12,
            overflow: "hidden",
        },
        bannerImage: {
            width: "100%",
            height: 120,
            borderRadius: 12,
        },
        imageOverlay: {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.3)",
            justifyContent: "center",
            alignItems: "center",
        },
        overlayButton: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 20,
        },
        overlayButtonText: {
            marginLeft: 8,
            color: ThemedColor.background,
            fontSize: 14,
        },
        removeButton: {
            position: "absolute",
            top: 8,
            right: 8,
            backgroundColor: "rgba(255, 255, 255, 0.9)",
            borderRadius: 15,
            width: 30,
            height: 30,
            justifyContent: "center",
            alignItems: "center",
        },
    });

export default Details;

import React, { useState } from "react";
import { View, StyleSheet, Image, TouchableOpacity, Alert, Dimensions } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import ThemedInput from "@/components/inputs/ThemedInput";
import Dropdown from "@/components/inputs/Dropdown";
import { BlueprintData } from "@/app/(logged-in)/blueprint/_layout";
import * as ImagePicker from "expo-image-picker";
import { uploadImageSmart } from "@/api/upload";
import { Ionicons } from "@expo/vector-icons";
import { ObjectId } from "bson";
import CachedImage from "../CachedImage";

// Common habit categories
const HABIT_CATEGORIES = [
    { label: "Health & Fitness", id: "health_fitness" },
    { label: "Productivity", id: "productivity" },
    { label: "Learning & Education", id: "learning_education" },
    { label: "Professional Development", id: "professional" },
    { label: "Household & Organization", id: "household" },
    { label: "Mental Wellness", id: "mental_wellness" },
    { label: "Relationships & Social", id: "relationships" },
    { label: "Creativity & Hobbies", id: "creativity" },
    { label: "Financial Management", id: "financial" },
    { label: "Self-Care & Personal", id: "self_care" },
];

const FOOTER_OPTIONS = [
    { label: "+ Custom Category", id: "custom", special: true },
];

type Props = {
    data: BlueprintData;
    onUpdate: (updates: Partial<BlueprintData>) => void;
};

const Details = ({ data, onUpdate }: Props) => {
    const ThemedColor = useThemeColor();
    const styles = createStyles(ThemedColor);
    const [isUploading, setIsUploading] = useState(false);
    const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
    const [showCustomCategory, setShowCustomCategory] = useState(false);
    
    // Initialize selected category
    const [selectedCategory, setSelectedCategory] = useState(() => {
        if (data.category) {
            // Find existing category in predefined list
            const existingCategory = HABIT_CATEGORIES.find(cat => 
                cat.label === data.category || cat.id === data.category
            );
            if (existingCategory) {
                return existingCategory;
            }
            // If it's a custom category, show it
            return { label: data.category, id: "custom_existing" };
        }
        return { label: "", id: "" };
    });

    const handleDurationChange = (duration: string) => {
        onUpdate({ duration });
    };

    const handleCategoryChange = (category: { label: string; id: string; special?: boolean }) => {
        setSelectedCategory(category);
        
        if (category.special && category.id === "custom") {
            // Show custom input
            setShowCustomCategory(true);
            return;
        }
        
        // Update with predefined category
        onUpdate({ category: category.label });
    };

    const handleCustomCategoryChange = (customCategory: string) => {
        onUpdate({ category: customCategory });
        setSelectedCategory({ label: customCategory, id: "custom_existing" });
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
            const tempBlueprintId = new ObjectId().toString();

            console.log("Uploading banner image...");
            const bannerImageUrl = await uploadImageSmart("blueprint", tempBlueprintId, imageUri, { variant: "large" });
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
                {showCustomCategory ? (
                    <View style={styles.customCategoryContainer}>
                        <ThemedInput
                            value={data.category}
                            setValue={handleCustomCategoryChange}
                            placeHolder="Enter custom category"
                            autofocus={true}
                        />
                        <TouchableOpacity
                            onPress={() => setShowCustomCategory(false)}
                            style={styles.backButton}
                        >
                            <ThemedText type="lightBody" style={styles.backButtonText}>
                                ← Back to Categories
                            </ThemedText>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <Dropdown
                        options={HABIT_CATEGORIES}
                        footerOptions={FOOTER_OPTIONS}
                        selected={selectedCategory}
                        setSelected={handleCategoryChange}
                        onSpecial={() => setShowCustomCategory(true)}
                        width="100%"
                    />
                )}
            </View>

            <View style={styles.fieldContainer}>
                <ThemedText type="lightBody" style={styles.fieldLabel}>
                    Banner Image
                </ThemedText>

                {displayImage ? (
                    <View style={styles.imageContainer}>
                        <CachedImage source={{ uri: displayImage }} style={styles.bannerImage} variant="large" cachePolicy="memory-disk" />
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
        customCategoryContainer: {
            gap: 12,
        },
        backButton: {
            alignSelf: "flex-start",
        },
        backButtonText: {
            color: ThemedColor.primary,
            fontSize: 14,
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
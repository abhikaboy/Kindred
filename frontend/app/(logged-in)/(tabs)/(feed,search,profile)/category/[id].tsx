import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import BlueprintCard from "@/components/cards/BlueprintCard";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Ionicons } from "@expo/vector-icons";
import { TouchableOpacity } from "react-native";
import { getBlueprintsByCategoryFromBackend } from "@/api/blueprint";
import type { components } from "@/api/generated/types";
import { CaretLeftIcon } from "phosphor-react-native";

type BlueprintDocument = components["schemas"]["BlueprintDocument"];
type BlueprintCategoryGroup = components["schemas"]["BlueprintCategoryGroup"];

export default function CategoryScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const ThemedColor = useThemeColor();
    const styles = useStyles(ThemedColor);

    const [blueprints, setBlueprints] = useState<BlueprintDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const categoryName = id;

    useEffect(() => {
        if (categoryName) {
            fetchCategoryBlueprints();
        }
    }, [categoryName]);

    const fetchCategoryBlueprints = async () => {
        try {
            setLoading(true);
            setError(null);

            const allCategories = await getBlueprintsByCategoryFromBackend();
            const categoryData = allCategories.find(
                (group: BlueprintCategoryGroup) =>
                    group.category?.toLowerCase() === categoryName?.toLowerCase() ||
                    (categoryName === "uncategorized" && !group.category)
            );

            if (categoryData) {
                setBlueprints(categoryData.blueprints);
            } else {
                setBlueprints([]);
            }

            setLoading(false);
        } catch (err) {
            setError("Failed to load blueprints");
            setLoading(false);
        }
    };

    const handleBack = () => {
        router.back();
    };

    const displayCategory =
        categoryName === "uncategorized"
            ? "Uncategorized"
            : categoryName?.charAt(0).toUpperCase() + categoryName?.slice(1);

    if (loading) {
        return (
            <ThemedView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                        <Ionicons name="chevron-back" size={24} color={ThemedColor.text} />
                    </TouchableOpacity>
                    <ThemedText type="subtitle" style={styles.headerTitle}>
                        {displayCategory}
                    </ThemedText>
                    <View style={styles.headerSpacer} />
                </View>
            </ThemedView>
        );
        // FIGURE OUT LOADING FOR ALL PAGES
    }

    if (error) {
        return (
            <ThemedView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                        <CaretLeftIcon size={24} color={ThemedColor.text} />
                    </TouchableOpacity>
                    <ThemedText type="subtitle" style={styles.headerTitle}>
                        {displayCategory}
                    </ThemedText>
                    <View style={styles.headerSpacer} />
                </View>

                <View style={styles.errorContainer}>
                    <ThemedText style={styles.errorText}>{error}</ThemedText>
                    <TouchableOpacity onPress={fetchCategoryBlueprints} style={styles.retryButton}>
                        <ThemedText style={styles.retryText}>Try Again</ThemedText>
                    </TouchableOpacity>
                </View>
            </ThemedView>
        );
    }

    return (
        <ThemedView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color={ThemedColor.text} />
                </TouchableOpacity>
                <ThemedText type="subtitle" style={styles.headerTitle}>
                    {displayCategory}
                </ThemedText>
                <View style={styles.headerSpacer} />
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                <View style={styles.subHeader}>
                    <ThemedText type="defaultSemiBold" style={styles.countText}>
                        {blueprints.length} {blueprints.length === 1 ? "Blueprint" : "Blueprints"}
                    </ThemedText>
                </View>
                <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.blueprintsGrid}>
                    {blueprints.length > 0 ? (
                        blueprints.map((blueprint) => (
                            <View key={blueprint.id} style={styles.blueprintItem}>
                                <BlueprintCard {...blueprint} large={true} />
                            </View>
                        ))
                    ) : (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="folder-open-outline" size={64} color={ThemedColor.tabIconDefault} />
                            <ThemedText style={styles.emptyText}>No blueprints in this category yet</ThemedText>
                            <TouchableOpacity onPress={handleBack} style={styles.browseButton}>
                                <ThemedText style={styles.browseButtonText}>Browse Other Categories</ThemedText>
                            </TouchableOpacity>
                        </View>
                    )}
                </Animated.View>
            </ScrollView>
        </ThemedView>
    );
}

const useStyles = (ThemedColor: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: ThemedColor.background,
        },
        header: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingTop: 60, 
            paddingBottom: 16,
            borderBottomWidth: 1,
            borderBottomColor: ThemedColor.tertiary
        },
        backButton: {
            padding: 8,
        },
        headerTitle: {
            flex: 1,
            textAlign: "center",
            fontSize: 20,
        },
        headerSpacer: {
            width: 40, 
        },
        subHeader: {
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 4,
        },
        countText: {
            fontSize: 16,
            opacity: 0.8,
        },
        scrollContent: {
            flexGrow: 1,
        },
        blueprintsGrid: {
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: 100,
        },
        blueprintItem: {
            marginBottom: 6,
            backgroundColor: ThemedColor.cardBackground || ThemedColor.background,
            borderRadius: 16,
        },
        loadingContainer: {
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
        },
        loadingText: {
            marginTop: 12,
            opacity: 0.7,
        },
        errorContainer: {
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
        },
        errorText: {
            textAlign: "center",
            marginBottom: 16,
            opacity: 0.7,
        },
        retryButton: {
            paddingHorizontal: 24,
            paddingVertical: 12,
            backgroundColor: ThemedColor.primary,
            borderRadius: 8,
        },
        retryText: {
            color: "#FFFFFF",
            fontWeight: "600",
        },
        emptyContainer: {
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingVertical: 60,
        },
        emptyText: {
            marginTop: 16,
            opacity: 0.7,
            textAlign: "center",
            fontSize: 16,
        },
        browseButton: {
            marginTop: 24,
            paddingHorizontal: 24,
            paddingVertical: 12,
            backgroundColor: ThemedColor.primary,
            borderRadius: 8,
        },
        browseButtonText: {
            color: "#FFFFFF",
            fontWeight: "600",
        },
    });

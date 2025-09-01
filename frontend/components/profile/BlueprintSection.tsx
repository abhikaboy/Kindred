import React, { useState, useEffect } from "react";
import { View, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { ThemedText } from "../ThemedText";
import { ThemedView } from "../ThemedView";
import { useThemeColor } from "@/hooks/useThemeColor";
import { getBlueprintsByCreator } from "@/api/blueprint";
import { BlueprintCardSkeleton } from "../ui/SkeletonLoader";
import { showToast } from "@/utils/showToast";
import { useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { components } from "@/api/generated/types";
import BlueprintCard from "../cards/BlueprintCard";

type BlueprintDocumentWithoutSubscribers = components["schemas"]["BlueprintDocumentWithoutSubscribers"];

interface BlueprintSectionProps {
    userId: string;
    title?: string;
    showViewAll?: boolean;
    onViewAllPress?: () => void;
}

const BlueprintSection: React.FC<BlueprintSectionProps> = ({
    userId,
    title = "My Blueprints",
    showViewAll = true,
    onViewAllPress,
}) => {
    const ThemedColor = useThemeColor();
    const styles = stylesheet(ThemedColor);
    const router = useRouter();
    
    const [blueprints, setBlueprints] = useState<BlueprintDocumentWithoutSubscribers[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchBlueprints();
    }, [userId]);

    const fetchBlueprints = async () => {
        try {
            setLoading(true);
            setError(null);
            const userBlueprints = await getBlueprintsByCreator(userId);
            setBlueprints(userBlueprints);
        } catch (err) {
            console.error("Error fetching user blueprints:", err);
            setError("Failed to load blueprints");
            showToast("Failed to load blueprints", "danger");
        } finally {
            setLoading(false);
        }
    };

    const handleViewAllPress = () => {
        if (onViewAllPress) {
            onViewAllPress();
        } else {
            // Default navigation - could be to a full blueprints page
            router.push("/(logged-in)/(tabs)/(search)/search");
        }
    };

    const renderBlueprintCard = ({ item }: { item: BlueprintDocumentWithoutSubscribers }) => (
        <View style={styles.cardContainer}>
            <BlueprintCard
                id={item.id}
                banner={item.banner}
                name={item.name}
                duration={item.duration}
                subscribersCount={item.subscribersCount}
                description={item.description}
                tags={item.tags}
                subscribers={[]} // Not needed for display
                owner={item.owner}
                timestamp={item.timestamp}
                categories={item.categories}
                category={item.category}
            />
        </View>
    );

    const renderSkeletonCards = () => (
        <FlatList
            data={[1, 2, 3]}
            renderItem={() => (
                <View style={styles.cardContainer}>
                    <BlueprintCardSkeleton />
                </View>
            )}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
            keyExtractor={(item) => item.toString()}
        />
    );

    const renderEmptyState = () => (
        <View style={styles.emptyState}>
            <MaterialIcons name="lightbulb-outline" size={48} color={ThemedColor.caption} />
            <ThemedText type="caption" style={styles.emptyText}>
                No blueprints created yet
            </ThemedText>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <ThemedText type="subtitle" style={styles.title}>
                    {title}
                </ThemedText>
                {showViewAll && blueprints.length > 0 && (
                    <TouchableOpacity onPress={handleViewAllPress} style={styles.viewAllButton}>
                        <MaterialIcons name="arrow-forward" size={20} color={ThemedColor.primary} />
                    </TouchableOpacity>
                )}
            </View>

            {loading ? (
                renderSkeletonCards()
            ) : error ? (
                <View style={styles.errorState}>
                    <MaterialIcons name="error-outline" size={24} color={ThemedColor.destructive} />
                    <ThemedText type="caption" style={styles.errorText}>
                        {error}
                    </ThemedText>
                    <TouchableOpacity onPress={fetchBlueprints} style={styles.retryButton}>
                        <ThemedText type="caption" style={styles.retryText}>
                            Tap to retry
                        </ThemedText>
                    </TouchableOpacity>
                </View>
            ) : blueprints.length > 0 ? (
                <FlatList
                    data={blueprints}
                    renderItem={renderBlueprintCard}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.horizontalList}
                    keyExtractor={(item) => item.id}
                />
            ) : (
                renderEmptyState()
            )}
        </View>
    );
};

const stylesheet = (ThemedColor: any) =>
    StyleSheet.create({
        container: {
            marginBottom: 4,
        },
        header: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
        },
        title: {
            fontSize: 18,
            fontWeight: "600",
        },
        viewAllButton: {
            padding: 4,
        },
        horizontalList: {
            paddingHorizontal: 20,
            gap: 16,
        },
        cardContainer: {
            marginRight: 0, // Gap is handled by contentContainerStyle
        },
        emptyState: {
            alignItems: "center",
            paddingVertical: 40,
            paddingHorizontal: 20,
        },
        emptyText: {
            marginTop: 12,
            textAlign: "center",
        },
        errorState: {
            alignItems: "center",
            paddingVertical: 20,
            paddingHorizontal: 20,
        },
        errorText: {
            marginTop: 8,
            textAlign: "center",
            color: ThemedColor.destructive,
        },
        retryButton: {
            marginTop: 8,
            padding: 8,
        },
        retryText: {
            color: ThemedColor.primary,
            textDecorationLine: "underline",
        },
    });

export default BlueprintSection;

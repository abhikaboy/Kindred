import React, { useEffect } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    interpolate,
} from "react-native-reanimated";
import { useThemeColor } from "@/hooks/useThemeColor";

interface SkeletonProps {
    width: number | string;
    height: number;
    borderRadius?: number;
    style?: any;
}

export const SkeletonLoader: React.FC<SkeletonProps> = ({
    width,
    height,
    borderRadius = 8,
    style,
}) => {
    const ThemedColor = useThemeColor();
    const opacity = useSharedValue(0.3);

    useEffect(() => {
        opacity.value = withRepeat(
            withTiming(1, { duration: 1000 }),
            -1,
            true
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            opacity: opacity.value,
        };
    });

    return (
        <Animated.View
            style={[
                {
                    width,
                    height,
                    borderRadius,
                    backgroundColor: ThemedColor.lightened,
                },
                animatedStyle,
                style,
            ]}
        />
    );
};

// Blueprint Card Skeleton
export const BlueprintCardSkeleton: React.FC<{ large?: boolean }> = ({ large = false }) => {
    const ThemedColor = useThemeColor();
    const cardHeight = large ? 180 : 140;
    
    return (
        <View style={[styles.blueprintCardSkeleton, { backgroundColor: ThemedColor.background, height: cardHeight }]}>
            <SkeletonLoader width="100%" height={large ? 100 : 80} borderRadius={12} />
            <View style={styles.blueprintCardContent}>
                <SkeletonLoader width="80%" height={16} borderRadius={4} />
                <SkeletonLoader width="60%" height={12} borderRadius={4} style={{ marginTop: 4 }} />
                <View style={styles.blueprintCardFooter}>
                    <SkeletonLoader width={24} height={24} borderRadius={12} />
                    <SkeletonLoader width="40%" height={12} borderRadius={4} />
                </View>
            </View>
        </View>
    );
};

// User Row Skeleton
export const UserRowSkeleton: React.FC = () => {
    const ThemedColor = useThemeColor();
    
    return (
        <View style={[styles.userRowSkeleton, { backgroundColor: ThemedColor.background }]}>
            <SkeletonLoader width={48} height={48} borderRadius={24} />
            <View style={styles.userRowContent}>
                <SkeletonLoader width="60%" height={16} borderRadius={4} />
                <SkeletonLoader width="40%" height={12} borderRadius={4} style={{ marginTop: 4 }} />
            </View>
            <SkeletonLoader width={80} height={32} borderRadius={16} />
        </View>
    );
};

// Category Section Skeleton
export const CategorySectionSkeleton: React.FC = () => {
    return (
        <View style={styles.categorySectionSkeleton}>
            <SkeletonLoader width="30%" height={20} borderRadius={4} style={{ marginBottom: 12 }} />
            <View style={styles.categoryBlueprintsList}>
                {[...Array(3)].map((_, index) => (
                    <BlueprintCardSkeleton key={index} />
                ))}
            </View>
        </View>
    );
};

// Search Results Skeleton
export const SearchResultsSkeleton: React.FC<{ activeTab: number }> = ({ activeTab }) => {
    const ThemedColor = useThemeColor();
    
    return (
        <View style={styles.searchResultsSkeleton}>
            {/* Tab skeleton */}
            <View style={[styles.tabsSkeleton, { borderBottomColor: ThemedColor.lightened }]}>
                <SkeletonLoader width={100} height={32} borderRadius={16} />
                <SkeletonLoader width={80} height={32} borderRadius={16} />
            </View>
            
            {/* Results header skeleton */}
            <SkeletonLoader width="20%" height={20} borderRadius={4} style={{ marginHorizontal: 16, marginVertical: 20 }} />
            
            {/* Results content skeleton */}
            <View style={styles.searchResultsContent}>
                {activeTab === 0 ? (
                    // Blueprint results skeleton
                    <>
                        {[...Array(3)].map((_, index) => (
                            <View key={index} style={styles.searchResultItem}>
                                <BlueprintCardSkeleton large />
                            </View>
                        ))}
                    </>
                ) : (
                    // User results skeleton
                    <>
                        {[...Array(4)].map((_, index) => (
                            <View key={index} style={styles.searchResultItem}>
                                <UserRowSkeleton />
                            </View>
                        ))}
                    </>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    blueprintCardSkeleton: {
        borderRadius: 16,
        padding: 12,
        width: 160,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    blueprintCardContent: {
        marginTop: 8,
        gap: 4,
    },
    blueprintCardFooter: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginTop: 8,
    },
    userRowSkeleton: {
        flexDirection: "row",
        alignItems: "center",
        padding: 16,
        borderRadius: 16,
        gap: 12,
    },
    userRowContent: {
        flex: 1,
    },
    categorySectionSkeleton: {
        paddingHorizontal: 16,
        marginBottom: 24,
    },
    categoryBlueprintsList: {
        flexDirection: "row",
        gap: 12,
    },
    searchResultsSkeleton: {
        flex: 1,
    },
    tabsSkeleton: {
        flexDirection: "row",
        paddingHorizontal: 16,
        paddingBottom: 16,
        gap: 16,
        borderBottomWidth: 1,
    },
    searchResultsContent: {
        paddingHorizontal: 16,
    },
    searchResultItem: {
        marginBottom: 16,
    },
});

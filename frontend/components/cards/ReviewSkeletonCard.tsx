import React from "react";
import { View, StyleSheet } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";

type Props = {};

const ReviewSkeletonCard = (props: Props) => {
    const ThemedColor = useThemeColor();

    return (
        <View
            style={[
                styles.skeletonCard,
                {
                    borderColor: ThemedColor.tertiary,
                    transform: [{ translateY: 8 }],
                },
            ]}
        >
            <View style={[
                styles.cardContent,
                {
                    borderColor: ThemedColor.tertiary,
                },
            ]}>
                <View>
                    <View style={styles.row}>
                        <View style={[styles.skeletonBar, { backgroundColor: ThemedColor.tertiary, width: 60 }]} />
                        <View style={[styles.skeletonBar, { backgroundColor: ThemedColor.tertiary, width: 40 }]} />
                    </View>
                    <View style={styles.row}>
                        <View style={[styles.skeletonBar, { backgroundColor: ThemedColor.tertiary, width: 50 }]} />
                        <View style={[styles.skeletonBar, { backgroundColor: ThemedColor.tertiary, width: 100 }]} />
                    </View>
                    <View style={styles.row}>
                        <View style={[styles.skeletonBar, { backgroundColor: ThemedColor.tertiary, width: 70 }]} />
                        <View style={[styles.skeletonBar, { backgroundColor: ThemedColor.tertiary, width: 120 }]} />
                    </View>
                    <View style={styles.row}>
                        <View style={[styles.skeletonBar, { backgroundColor: ThemedColor.tertiary, width: 80 }]} />
                        <View style={[styles.skeletonBar, { backgroundColor: ThemedColor.tertiary, width: 90 }]} />
                    </View>
                </View>
                <View style={styles.bottomSection}>
                    <View style={[styles.skeletonBar, { backgroundColor: ThemedColor.tertiary, width: 100, marginBottom: 8 }]} />
                    <View style={[styles.skeletonBar, { backgroundColor: ThemedColor.tertiary, width: "75%", height: 24 }]} />
                </View>
            </View>
        </View>
    );
};

export default ReviewSkeletonCard;

const styles = StyleSheet.create({
    skeletonCard: {
        position: "absolute",
        width: "100%",
        height: "100%",
        borderRadius: 12,
        borderWidth: 1,
        backgroundColor: "transparent",
    },
    cardContent: {
        width: "100%",
        height: "100%",
        borderRadius: 12,
        borderWidth: 1,
        padding: 16,
        justifyContent: "space-between",
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 8,
    },
    skeletonBar: {
        height: 16,
        borderRadius: 4,
        opacity: 0.3,
    },
    bottomSection: {
        flex: 1,
        justifyContent: "flex-end",
    },
});


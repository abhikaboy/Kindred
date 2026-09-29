import { StyleSheet, ScrollView, View, TouchableOpacity, ActivityIndicator } from "react-native";
import React from "react";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import { router } from "expo-router";
import { X } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useReleasedTasks, releasedAgoLabel } from "@/hooks/useReleasedTasks";

// Settings sub-screen (same shell as blocked-users): close button, centered title.
const ReleasedTasks = () => {
    const ThemedColor = useThemeColor();
    const { tasks, loading, error, bringBack } = useReleasedTasks();
    const now = new Date();

    return (
        <View style={[styles.container, { backgroundColor: ThemedColor.background }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <X size={24} color={ThemedColor.text} weight="bold" />
                </TouchableOpacity>
                <ThemedText type="defaultSemiBold" style={styles.headerTitle}>
                    Released tasks
                </ThemedText>
                <View style={styles.placeholder} />
            </View>

            {loading && tasks.length === 0 ? (
                <View style={styles.center}>
                    <ActivityIndicator color={ThemedColor.caption} />
                </View>
            ) : error && tasks.length === 0 ? (
                <View style={styles.body}>
                    <ThemedText type="caption">Couldn't load released tasks right now.</ThemedText>
                </View>
            ) : tasks.length === 0 ? (
                <Animated.View entering={FadeIn.duration(200)} style={styles.body}>
                    <ThemedText type="caption">Nothing released</ThemedText>
                </Animated.View>
            ) : (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
                    {tasks.map((task) => (
                        <Animated.View
                            key={task.id}
                            exiting={FadeOut.duration(160)}
                            layout={LinearTransition.duration(200)}
                            style={styles.row}>
                            <View style={styles.rowText}>
                                <ThemedText type="default" numberOfLines={2}>
                                    {task.content}
                                </ThemedText>
                                <ThemedText type="caption">{releasedAgoLabel(task.releasedAt, now)}</ThemedText>
                            </View>
                            <TouchableOpacity
                                onPress={() => bringBack(task)}
                                hitSlop={8}
                                accessibilityRole="button"
                                accessibilityLabel={`Bring back ${task.content}`}>
                                <ThemedText type="default" style={{ color: ThemedColor.primary }}>
                                    Bring back
                                </ThemedText>
                            </TouchableOpacity>
                        </Animated.View>
                    ))}
                </ScrollView>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 16,
        paddingTop: 60,
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 20,
    },
    placeholder: {
        width: 40,
    },
    center: {
        paddingTop: 32,
        alignItems: "center",
    },
    body: {
        paddingHorizontal: 24,
    },
    list: {
        paddingHorizontal: 24,
        paddingBottom: 120,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
        paddingVertical: 12,
    },
    rowText: {
        flex: 1,
        gap: 4,
    },
});

export default ReleasedTasks;

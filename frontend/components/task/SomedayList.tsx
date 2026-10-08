import { StyleSheet, ScrollView, View, TouchableOpacity, ActivityIndicator } from "react-native";
import React, { useCallback } from "react";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import { router } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { SectionTitle } from "@/components/dashboard/SectionHeader";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useSomedayTasks } from "@/hooks/useSomedayTasks";
import { openPlanSheet } from "@/hooks/planSheetStore";
import type { Task } from "@/api/types";

const SomedayRow = React.memo(({ task }: { task: Task }) => {
    const ThemedColor = useThemeColor();
    const openTask = useCallback(() => {
        router.push({
            pathname: "/(logged-in)/(tabs)/(task)/task/[id]",
            params: { name: task.content, id: task.id, categoryId: task.categoryID ?? "" },
        });
    }, [task.content, task.id, task.categoryID]);

    return (
        <Animated.View exiting={FadeOut.duration(160)} layout={LinearTransition.duration(200)}>
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={openTask}
                style={[styles.row, { backgroundColor: ThemedColor.lightenedCard }]}>
                <ThemedText type="default" numberOfLines={2}>
                    {task.content}
                </ThemedText>
                <TouchableOpacity
                    onPress={() => openPlanSheet({ task })}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Give ${task.content} a first step`}>
                    <ThemedText type="default" style={[styles.action, { color: ThemedColor.primary }]}>
                        Give it a first step
                    </ThemedText>
                </TouchableOpacity>
            </TouchableOpacity>
        </Animated.View>
    );
});

/** The someday list body, shared by the dedicated route and the pager's Someday page. */
export const SomedayList = () => {
    const ThemedColor = useThemeColor();
    const { groups, loading } = useSomedayTasks();

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator color={ThemedColor.caption} />
            </View>
        );
    }

    if (groups.length === 0) {
        return (
            <Animated.View entering={FadeIn.duration(200)}>
                <ThemedText type="caption">Tasks without a date live here.</ThemedText>
            </Animated.View>
        );
    }

    return (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
            {groups.map((group) => (
                <Animated.View
                    key={group.workspace}
                    entering={FadeIn.duration(200)}
                    exiting={FadeOut.duration(160)}
                    layout={LinearTransition.duration(200)}
                    style={styles.section}>
                    <SectionTitle title={group.workspace} />
                    <View style={styles.rows}>
                        {group.tasks.map((task) => (
                            <SomedayRow key={task.id} task={task} />
                        ))}
                    </View>
                </Animated.View>
            ))}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    center: {
        paddingTop: 32,
        alignItems: "center",
    },
    list: {
        paddingBottom: 120,
        gap: 32,
    },
    section: {
        gap: 12,
    },
    rows: {
        gap: 12,
    },
    // Lighter than a dated task card: no border, no chips, just a soft shadow.
    row: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 16,
        gap: 4,
        boxShadow: "0px 4px 16px -8px rgba(0,0,0,0.16)",
    },
    action: {
        fontSize: 14,
        lineHeight: 20,
    },
});

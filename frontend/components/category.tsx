import React, { useRef, useCallback, useEffect } from "react";
import { StyleSheet, View, TouchableOpacity, ScrollView } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { useDragOptional } from "@/contexts/dragContext";
import { ThemedText } from "./ThemedText";
import TaskCard from "./cards/TaskCard";
import { Task } from "../api/types";
import SwipableTaskCard from "./cards/SwipableTaskCard";
import { useTasks } from "@/contexts/tasksContext";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Plus } from "phosphor-react-native";
import { useRouter } from "expo-router";
import TagChip from "@/components/TagChip";

interface CategoryProps {
    id: string;
    name: string;
    tasks: Task[];
    tags?: string[];
    onLongPress: (categoryId: string) => void;
    onPress: (categoryId: string) => void;
    viewOnly?: boolean;
    highlightFirstTask?: boolean;
    highlightCategoryHeader?: boolean;
}

export const Category: React.FC<CategoryProps> = ({
    id,
    name,
    tasks,
    tags = [],
    onLongPress,
    onPress,
    viewOnly = false,
    highlightFirstTask = false,
    highlightCategoryHeader = false
}) => {
    const { setCreateCategory } = useTasks();
    const ThemedColor = useThemeColor();
    const router = useRouter();

    const drag = useDragOptional();
    const containerRef = useRef<View>(null);
    const isDropTarget = drag?.hoveredCategoryId === id;

    // Fade the drop-target highlight in/out instead of snapping it on/off.
    const highlight = useSharedValue(0);
    useEffect(() => {
        highlight.value = withTiming(isDropTarget ? 1 : 0, { duration: 180 });
    }, [isDropTarget]);
    const fillStyle = useAnimatedStyle(() => ({ opacity: highlight.value }));
    const borderStyle = useAnimatedStyle(() => ({ opacity: highlight.value * 0.1 }));

    const measure = useCallback(() => {
        if (!drag) return;
        containerRef.current?.measureInWindow((x, y, width, height) => {
            drag.setCategoryRect({ categoryId: id, x, y, width, height });
        });
    }, [drag, id]);

    useEffect(() => {
        return () => {
            drag?.removeCategoryRect(id);
        };
    }, [drag, id]);

    // PagerView reveals an offscreen page without re-firing onLayout, leaving
    // this category's hit-rect stale or unregistered (rects=0). Re-measure the
    // moment a drag starts so the hit-test runs against fresh coordinates.
    useEffect(() => {
        if (drag?.isDragging) measure();
    }, [drag?.isDragging, measure]);

    const categoryNameText = (
        <ThemedText type={tasks.length > 0 ? "subtitle" : "disabledTitle"}>{name}</ThemedText>
    );

    return (
        <View
            style={styles.container}
            ref={containerRef}
            onLayout={measure}
            collapsable={false}>
            {/* Drop-target highlight = two always-mounted absolute overlays whose
                opacity fades with `highlight`, so it never changes layout (a
                growing/shrinking category would re-stale sibling hit rects
                mid-drag). Fill sits behind content; border paints on top. */}
            <Animated.View
                pointerEvents="none"
                style={[
                    {
                        position: "absolute",
                        top: -8,
                        left: -8,
                        right: -8,
                        bottom: -8,
                        borderRadius: 12,
                        backgroundColor: ThemedColor.lightenedCard,
                        // Drop shadow so the targeted category lifts off the page.
                        shadowColor: "#000",
                        shadowOpacity: 0.28,
                        shadowRadius: 11,
                        shadowOffset: { width: 0, height: 5 },
                        elevation: 9,
                    },
                    fillStyle,
                ]}
            />
            <TouchableOpacity
                style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}
                onLongPress={() => onLongPress(id)}
                disabled={viewOnly}
                onPress={() => {
                    onPress(id);
                    setCreateCategory({ label: name, id: id, special: false });
                }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 }}>
                    {categoryNameText}
                    {tags.length > 0 && (
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ gap: 6, alignItems: "center" }}
                            style={{ flexShrink: 1 }}>
                            {tags.map((tag) => (
                                <TagChip
                                    key={tag}
                                    tag={tag}
                                    onPress={(t) => router.push(`/tag/${encodeURIComponent(t)}`)}
                                />
                            ))}
                        </ScrollView>
                    )}
                </View>
                {!viewOnly && <Plus size={16} weight="bold" color={ThemedColor.text} />}
            </TouchableOpacity>
            {tasks.map((task, index) => {
                const isFirstTask = index === 0 && highlightFirstTask;

                return !viewOnly ? (
                    <SwipableTaskCard
                        key={task.id + task.content}
                        redirect={!viewOnly}
                        categoryId={id}
                        categoryName={name}
                        task={task}
                        highlightContent={isFirstTask}
                    />
                ) : (
                    <TaskCard
                        key={task.id + task.content}
                        content={task.content}
                        value={task.value}
                        priority={task.priority as any}
                        id={task.id}
                        categoryId={id}
                        highlightContent={isFirstTask}
                    />
                );
            })}
            <Animated.View
                pointerEvents="none"
                style={[
                    {
                        position: "absolute",
                        top: -8,
                        left: -8,
                        right: -8,
                        bottom: -8,
                        borderRadius: 12,
                        borderWidth: 1.5,
                        borderColor: ThemedColor.primary,
                        zIndex: 10,
                        elevation: 11,
                    },
                    borderStyle,
                ]}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        gap: 12,
        marginBottom: 4,
    },
});

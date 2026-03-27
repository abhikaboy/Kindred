import React, { useState } from "react";
import { StyleSheet, View, TouchableOpacity } from "react-native";
import { ThemedText } from "./ThemedText";
import { Task } from "../api/types";
import SwipableTaskCard from "./cards/SwipableTaskCard";
import { useThemeColor } from "@/hooks/useThemeColor";
import { CaretDown, CaretRight } from "phosphor-react-native";
import { MotiView, AnimatePresence } from "moti";

interface UpcomingCategoryProps {
    tasks: Task[];
    categoryId: string;
}

export const UpcomingCategory: React.FC<UpcomingCategoryProps> = ({ tasks, categoryId }) => {
    const ThemedColor = useThemeColor();
    const [expanded, setExpanded] = useState(false);

    if (tasks.length === 0) return null;

    return (
        <View style={styles.container}>
            <View style={[styles.dividerLine, { backgroundColor: ThemedColor.disabled }]} />
            <TouchableOpacity
                style={styles.header}
                activeOpacity={0.6}
                onPress={() => setExpanded((v) => !v)}>
                <ThemedText type="lightBody" style={{ color: ThemedColor.caption }}>
                    Upcoming Recurring Tasks
                </ThemedText>
                {expanded ? (
                    <CaretDown size={14} color={ThemedColor.caption} />
                ) : (
                    <CaretRight size={14} color={ThemedColor.caption} />
                )}
            </TouchableOpacity>
            <AnimatePresence>
                {expanded && (
                    <MotiView
                        from={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" as any }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ type: "timing", duration: 200 }}
                        style={{ overflow: "hidden", gap: 12 }}>
                        {tasks.map((task) => (
                            <SwipableTaskCard
                                key={task.id + task.content}
                                redirect={false}
                                categoryId={categoryId}
                                categoryName="Upcoming"
                                task={task}
                            />
                        ))}
                    </MotiView>
                )}
            </AnimatePresence>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        gap: 12,
        marginBottom: 4,
    },
    dividerLine: {
        height: StyleSheet.hairlineWidth,
        marginBottom: 2,
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
});

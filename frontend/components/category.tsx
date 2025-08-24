import React from "react";
import { StyleSheet, View, TouchableOpacity } from "react-native";
import { ThemedText } from "./ThemedText";
import TaskCard from "./cards/TaskCard";
import { Task } from "../api/types";
import SwipableTaskCard from "./cards/SwipableTaskCard";
import { useTasks } from "@/contexts/tasksContext";
import AntDesign from "@expo/vector-icons/AntDesign";
import { useThemeColor } from "@/hooks/useThemeColor";
interface CategoryProps {
    id: string;
    name: string;
    tasks: Task[];
    onLongPress: (categoryId: string) => void;
    onPress: (categoryId: string) => void;
    viewOnly?: boolean;
}

export const Category: React.FC<CategoryProps> = ({ id, name, tasks, onLongPress, onPress, viewOnly = false }) => {
    const { setCreateCategory } = useTasks();
    const ThemedColor = useThemeColor();
    return (
        <View style={styles.container}>
            <TouchableOpacity
                style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
                onLongPress={() => onLongPress(id)}
                disabled={viewOnly} 
                onPress={() => {
                    onPress(id);
                    setCreateCategory({ label: name, id: id, special: false });
                }}>
                <ThemedText type={tasks.length > 0 ? "subtitle" : "disabledTitle"}>{name}</ThemedText>
                {!viewOnly && <AntDesign name="plus" size={16} color={ThemedColor.caption} />}
            </TouchableOpacity>
            {tasks.map((task) => (
                !viewOnly ? (
                <SwipableTaskCard
                    key={task.id + task.content}
                    redirect={!viewOnly}
                    categoryId={id}
                    categoryName={name}
                    task={task}
                />
                ) : (
                    <TaskCard
                        key={task.id + task.content}
                        content={task.content}
                        value={task.value}
                        priority={task.priority as any}
                        id={task.id}
                        categoryId={id}
                    />
                )
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        gap: 16,
        marginBottom: 4,
    },
});

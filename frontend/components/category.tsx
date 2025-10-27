import React from "react";
import { StyleSheet, View, TouchableOpacity } from "react-native";
import { ThemedText } from "./ThemedText";
import TaskCard from "./cards/TaskCard";
import { Task } from "../api/types";
import SwipableTaskCard from "./cards/SwipableTaskCard";
import { useTasks } from "@/contexts/tasksContext";
import AntDesign from "@expo/vector-icons/AntDesign";
import { useThemeColor } from "@/hooks/useThemeColor";
import { AttachStep } from "react-native-spotlight-tour";

interface CategoryProps {
    id: string;
    name: string;
    tasks: Task[];
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
    onLongPress, 
    onPress, 
    viewOnly = false,
    highlightFirstTask = false,
    highlightCategoryHeader = false
}) => {
    const { setCreateCategory } = useTasks();
    const ThemedColor = useThemeColor();
    
    const categoryNameText = (
        <ThemedText type={tasks.length > 0 ? "subtitle" : "disabledTitle"}>{name}</ThemedText>
    );
    
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
                {highlightCategoryHeader ? (
                    <AttachStep index={2}>
                        {categoryNameText}
                    </AttachStep>
                ) : (
                    categoryNameText
                )}
                {!viewOnly && <AntDesign name="plus" size={16} color={ThemedColor.caption} />}
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
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        gap: 12,
        marginBottom: 4,
    },
});

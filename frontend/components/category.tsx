import React from "react";
import { StyleSheet, View, TouchableOpacity } from "react-native";
import { ThemedText } from "./ThemedText";
import TaskCard from "./cards/TaskCard";
import { Task } from "../api/types";

interface CategoryProps {
    id: string;
    name: string;
    tasks: Task[];
    onLongPress: (categoryId: string) => void;
    onPress: (categoryId: string) => void;
}

export const Category: React.FC<CategoryProps> = ({ id, name, tasks, onLongPress, onPress }) => {
    return (
        <View style={styles.container}>
            <TouchableOpacity onLongPress={() => onLongPress(id)} onPress={() => onPress(id)}>
                <ThemedText type={tasks.length > 0 ? "subtitle" : "disabledTitle"}>{name}</ThemedText>
            </TouchableOpacity>
            {tasks.map((task) => (
                <TaskCard
                    key={task.id + task.content}
                    content={task.content}
                    value={0 || task.value}
                    priority={task.priority as unknown as 1 | 2 | 3}
                    redirect={true}
                    id={task.id}
                    categoryId={id}
                />
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        gap: 16,
    },
});

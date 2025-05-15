import React from "react";
import { StyleSheet, View, TouchableOpacity } from "react-native";
import { ThemedText } from "./ThemedText";
import TaskCard from "./cards/TaskCard";
import { Task } from "../api/types";
import SwipableTaskCard from "./cards/SwipableTaskCard";
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
                <SwipableTaskCard key={task.id + task.content} redirect={true} categoryId={id} task={task} />
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        gap: 16,
    },
});

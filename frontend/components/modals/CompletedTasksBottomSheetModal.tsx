import React, { useEffect, useState } from "react";
import { View, StyleSheet, FlatList } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import DefaultModal from "./DefaultModal";
import { activityAPI, TaskDocument } from "@/api/activity";
import { useThemeColor } from "@/hooks/useThemeColor";
import { formatDistanceToNow } from "date-fns";

interface Props {
    visible: boolean;
    setVisible: (visible: boolean) => void;
    date: Date | null;
}

export default function CompletedTasksBottomSheetModal({ visible, setVisible, date }: Props) {
    const [tasks, setTasks] = useState<TaskDocument[]>([]);
    const [loading, setLoading] = useState(false);
    const ThemedColor = useThemeColor();

    useEffect(() => {
        if (visible && date) {
            fetchTasks();
        }
    }, [visible, date]);

    const fetchTasks = async () => {
        if (!date) return;
        setLoading(true);
        try {
            const fetchedTasks = await activityAPI.getCompletedTasksByDate(date);
            setTasks(fetchedTasks);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const renderItem = ({ item }: { item: TaskDocument }) => (
        <View style={[styles.taskItem, { backgroundColor: ThemedColor.lightenedCard, borderColor: ThemedColor.tertiary }]}>
            <ThemedText type="defaultSemiBold">{item.content}</ThemedText>
            {item.timeCompleted && (
                 <ThemedText type="caption" style={{ color: ThemedColor.caption }}>
                    {formatDistanceToNow(new Date(item.timeCompleted), { addSuffix: true })}
                </ThemedText>
            )}
        </View>
    );

    return (
        <DefaultModal visible={visible} setVisible={setVisible}>
            <View style={styles.container}>
                <ThemedText type="subtitle" style={styles.title}>
                    Completed on {date?.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </ThemedText>
                {loading ? (
                     <ThemedText>Loading...</ThemedText>
                ) : tasks.length === 0 ? (
                    <ThemedText>No tasks completed on this day.</ThemedText>
                ) : (
                    <FlatList
                        data={tasks}
                        renderItem={renderItem}
                        keyExtractor={(item) => item.id || (item as any)._id}
                        contentContainerStyle={styles.list}
                    />
                )}
            </View>
        </DefaultModal>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 4,
        height: '100%',
    },
    title: {
        marginBottom: 16,
    },
    list: {
        gap: 12,
    },
    taskItem: {
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        gap: 4,
    }
});


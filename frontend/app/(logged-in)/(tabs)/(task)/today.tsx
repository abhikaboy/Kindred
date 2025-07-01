import { Dimensions, StyleSheet, ScrollView, View, TouchableOpacity } from "react-native";
import React, { useRef } from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useTasks } from "@/contexts/tasksContext";
import Feather from "@expo/vector-icons/Feather";
import { Drawer } from "@/components/home/Drawer";
import { DrawerLayout } from "react-native-gesture-handler";
import SwipableTaskCard from "@/components/cards/SwipableTaskCard";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";

const Today = () => {
    const ThemedColor = useThemeColor();
    const { startTodayTasks, dueTodayTasks } = useTasks();
    const drawerRef = useRef(null);

    return (
        <DrawerLayout
            ref={drawerRef}
            hideStatusBar
            edgeWidth={50}
            drawerWidth={Dimensions.get("screen").width * 0.75}
            renderNavigationView={() => <Drawer close={drawerRef.current?.closeDrawer} />}
            drawerPosition="left"
            drawerType="front">
            <ThemedView style={styles.container}>
                <TouchableOpacity onPress={() => drawerRef.current?.openDrawer()}>
                    <Feather name="menu" size={24} color={ThemedColor.caption} />
                </TouchableOpacity>
                <View style={styles.headerContainer}>
                    <ThemedText type="title" style={styles.title}>
                        {new Date().toLocaleDateString("en-US", { weekday: "long" })},{" "}
                        {new Date().toLocaleDateString("en-US", { month: "long" })}{" "}
                        {new Date().toLocaleDateString("en-US", { day: "numeric" })}
                    </ThemedText>
                    <ThemedText type="lightBody" style={{ lineHeight: 24, marginTop: 4 }}>
                        This is a glance of your tasks today, feel free to navigate to your workspaces to add new tasks!
                    </ThemedText>
                </View>
                <ScrollView style={{ gap: 16 }} contentContainerStyle={{ gap: 24 }}>
                    <View style={{ gap: 8 }}>
                        <ThemedText type="subtitle">Due Today</ThemedText>
                        <ScrollView contentContainerStyle={{ gap: 16 }}>
                            {dueTodayTasks.length === 0 ? (
                                <ThemedText type="lightBody">No tasks due today.</ThemedText>
                            ) : (
                                dueTodayTasks.map((task) => (
                                    <SwipableTaskCard
                                        key={task.id}
                                        redirect={true}
                                        categoryId={task.categoryID}
                                        task={task}
                                    />
                                ))
                            )}
                        </ScrollView>
                    </View>
                    <View style={{ gap: 8 }}>
                        <ThemedText type="subtitle">Scheduled for Today</ThemedText>
                        <ScrollView contentContainerStyle={{ gap: 16 }}>
                            {startTodayTasks.length === 0 ? (
                                <ThemedText type="lightBody">No tasks scheduled for today.</ThemedText>
                            ) : (
                                startTodayTasks.map((task) => (
                                    <SwipableTaskCard
                                        key={task.id}
                                        redirect={true}
                                        categoryId={task.categoryID}
                                        task={task}
                                    />
                                ))
                            )}
                        </ScrollView>
                    </View>
                </ScrollView>
            </ThemedView>
        </DrawerLayout>
    );
};

export default Today;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: Dimensions.get("screen").height * 0.09,
        paddingHorizontal: HORIZONTAL_PADDING,
        paddingBottom: Dimensions.get("screen").height * 0.12,
    },
    headerContainer: {
        paddingBottom: 24,
        paddingTop: 20,
    },
    title: {
        fontWeight: "600",
    },
    dayOfWeek: {
        marginTop: 4,
        marginBottom: 8,
    },
});

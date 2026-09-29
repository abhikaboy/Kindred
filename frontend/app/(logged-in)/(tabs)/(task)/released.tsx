import { Dimensions, StyleSheet, ScrollView, View, TouchableOpacity, ActivityIndicator } from "react-native";
import React, { useRef } from "react";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import Feather from "@expo/vector-icons/Feather";
import { Drawer } from "@/components/home/Drawer";
import { DrawerLayout } from "react-native-gesture-handler";
import { useThemeColor } from "@/hooks/useThemeColor";
import { DRAWER_WIDTH, HORIZONTAL_PADDING } from "@/constants/spacing";
import { useDrawer } from "@/contexts/drawerContext";
import { useReleasedTasks, releasedAgoLabel } from "@/hooks/useReleasedTasks";

const ReleasedTasks = () => {
    const ThemedColor = useThemeColor();
    const drawerRef = useRef<any>(null);
    const { setIsDrawerOpen } = useDrawer();
    const { tasks, loading, error, bringBack } = useReleasedTasks();
    const now = new Date();

    return (
        <DrawerLayout
            ref={drawerRef}
            hideStatusBar
            edgeWidth={50}
            drawerWidth={DRAWER_WIDTH}
            renderNavigationView={() => <Drawer close={drawerRef.current?.closeDrawer} />}
            drawerPosition="left"
            drawerType="front"
            onDrawerOpen={() => setIsDrawerOpen(true)}
            onDrawerClose={() => setIsDrawerOpen(false)}>
            <ThemedView style={styles.container}>
                <TouchableOpacity onPress={() => drawerRef.current?.openDrawer()}>
                    <Feather name="menu" size={24} color={ThemedColor.caption} />
                </TouchableOpacity>

                <View style={styles.header}>
                    <ThemedText type="title" style={styles.title}>
                        Released
                    </ThemedText>
                </View>

                {loading && tasks.length === 0 ? (
                    <View style={styles.center}>
                        <ActivityIndicator color={ThemedColor.caption} />
                    </View>
                ) : error && tasks.length === 0 ? (
                    <ThemedText type="caption">Couldn't load released tasks right now.</ThemedText>
                ) : tasks.length === 0 ? (
                    <Animated.View entering={FadeIn.duration(200)}>
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
            </ThemedView>
        </DrawerLayout>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: Dimensions.get("screen").height * 0.09,
        paddingHorizontal: HORIZONTAL_PADDING,
    },
    header: {
        paddingTop: 20,
        paddingBottom: 24,
    },
    title: {
        fontWeight: "600",
    },
    center: {
        paddingTop: 32,
        alignItems: "center",
    },
    list: {
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

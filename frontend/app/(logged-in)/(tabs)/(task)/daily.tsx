import { Dimensions, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import React, { useRef, useState, useEffect } from "react";
import { DrawerLayout } from "react-native-gesture-handler";
import { Drawer } from "@/components/home/Drawer";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Feather } from "@expo/vector-icons";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { useThemeColor } from "@/hooks/useThemeColor";
import Entry from "@/components/daily/Entry";
import PagerView from "react-native-pager-view";
import { useTasks } from "@/contexts/tasksContext";
import SwipableTaskCard from "@/components/cards/SwipableTaskCard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDrawer } from "@/contexts/drawerContext";

type Props = {};

const PAGE_SIZE = 6;

function getDateArray(startDate: Date, numDays: number) {
    return Array.from({ length: numDays }, (_, i) => {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        return d;
    });
}

const Daily = (props: Props) => {
    const drawerRef = useRef(null);
    const pagerRef = useRef<PagerView>(null);
    const ThemedColor = useThemeColor();
    const insets = useSafeAreaInsets();
    // Center date is the first day of the current window
    const [centerDate, setCenterDate] = useState(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    });
    const [selectedDate, setSelectedDate] = useState(centerDate);
    const [pageIndex, setPageIndex] = useState(1); // 0: prev, 1: current, 2: next

    // Calculate date windows
    const prevStart = new Date(centerDate);
    prevStart.setDate(centerDate.getDate() - PAGE_SIZE);
    const nextStart = new Date(centerDate);
    nextStart.setDate(centerDate.getDate() + PAGE_SIZE);

    const prevDates = getDateArray(prevStart, PAGE_SIZE);
    const currentDates = getDateArray(centerDate, PAGE_SIZE);
    const nextDates = getDateArray(nextStart, PAGE_SIZE);

    // Handle page change
    const onPageSelected = (e: any) => {
        const position = e.nativeEvent.position;
        if (position === 2) {
            // Swiped forward
            const newCenter = new Date(centerDate);
            newCenter.setDate(centerDate.getDate() + PAGE_SIZE);
            setCenterDate(newCenter);
            setPageIndex(1);
        } else if (position === 0) {
            // Swiped backward
            const newCenter = new Date(centerDate);
            newCenter.setDate(centerDate.getDate() - PAGE_SIZE);
            setCenterDate(newCenter);
            setPageIndex(1);
        } else {
            setPageIndex(position);
        }
    };

    // After centerDate changes, reset PagerView to the middle page
    useEffect(() => {
        if (pagerRef.current && pageIndex !== 1) {
            pagerRef.current.setPageWithoutAnimation(1);
        }
    }, [centerDate]);

    // Helper to render a page of dates
    const renderDatePage = (dates: Date[]) => (
        <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
                <ThemedText type="subtitle">{centerDate.toLocaleDateString("en-US", { month: "long" })}</ThemedText>
            </View>
            <View
                style={{
                    gap: 12,
                    flexDirection: "row",
                }}>
                {dates.map((date, idx) => (
                    <Entry
                        day={date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}
                        date={date.getDate().toString()}
                        outline={
                            date.getMonth() === selectedDate.getMonth() &&
                            date.getUTCDate() === selectedDate.getUTCDate()
                        }
                        onPress={() => setSelectedDate(date)}
                        key={date.toISOString()}
                    />
                ))}
            </View>
        </View>
    );

    const { startTodayTasks, dueTodayTasks, pastStartTasks, pastDueTasks, futureTasks, allTasks } = useTasks();
    const { setIsDrawerOpen } = useDrawer();

    return (
        <DrawerLayout
            ref={drawerRef}
            hideStatusBar
            edgeWidth={50}
            drawerWidth={Dimensions.get("screen").width * 0.75}
            renderNavigationView={() => <Drawer close={drawerRef.current?.closeDrawer} />}
            drawerPosition="left"
            drawerType="front"
            onDrawerOpen={() => setIsDrawerOpen(true)}
            onDrawerClose={() => setIsDrawerOpen(false)}>
            <View style={[styles.container, { flex: 1, paddingTop: insets.top }]}>
                <TouchableOpacity onPress={() => drawerRef.current?.openDrawer()}>
                    <Feather name="menu" size={24} color={ThemedColor.caption} />
                </TouchableOpacity>
                <View style={styles.headerContainer}>
                    <ThemedText type="title" style={styles.title}>
                        kindred daily view
                    </ThemedText>
                </View>
                <View style={{ marginBottom: 24, height: Dimensions.get("screen").height * 0.125 }}>
                    <PagerView
                        ref={pagerRef}
                        style={{ flex: 1 }}
                        initialPage={1}
                        onPageSelected={onPageSelected}
                        key={centerDate.toISOString()}>
                        <View key="prev" style={{ flex: 1 }}>
                            {renderDatePage(prevDates)}
                        </View>
                        <View key="current" style={{ flex: 1 }}>
                            {renderDatePage(currentDates)}
                        </View>
                        <View key="next" style={{ flex: 1 }}>
                            {renderDatePage(nextDates)}
                        </View>
                    </PagerView>
                </View>
                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 24, paddingBottom: 50 }}>
                    <View style={{ gap: 8 }}>
                        <ThemedText type="subtitle">To-Do</ThemedText>
                        {startTodayTasks.map((task) => (
                            <SwipableTaskCard
                                key={task.id + task.content}
                                redirect={true}
                                categoryId={task.categoryID}
                                task={task}
                            />
                        ))}
                    </View>
                    <View style={{ gap: 8 }}>
                        <ThemedText type="subtitle">
                            Due on {selectedDate.toLocaleDateString("en-US", { month: "long", day: "numeric" })}
                        </ThemedText>
                    </View>
                    <View style={{ gap: 8 }}>
                        <ThemedText type="subtitle">Workspaces</ThemedText>
                    </View>
                </ScrollView>
            </View>
        </DrawerLayout>
    );
};

export default Daily;

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: HORIZONTAL_PADDING,
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

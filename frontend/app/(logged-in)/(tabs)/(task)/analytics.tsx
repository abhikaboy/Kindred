import { Dimensions, ScrollView, StyleSheet, TouchableOpacity, View, Image, useColorScheme } from "react-native";
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
import { useDrawer } from "@/contexts/drawerContext";
import { useLocalSearchParams } from "expo-router";

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
    const colorScheme = useColorScheme();

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
            <View style={[styles.container, { flex: 1 }]}>
                <TouchableOpacity onPress={() => drawerRef.current?.openDrawer()}>
                    <Feather name="menu" size={24} color={ThemedColor.caption} />
                </TouchableOpacity>
                <View style={styles.headerContainer}>
                    <ThemedText type="title" style={styles.title}>
                        Analytics
                    </ThemedText>
                </View>

                {/* Coming Soon Overlay */}
                <View style={styles.comingSoonContainer}>
                    <View style={styles.comingSoonContent}>
                        <Image
                            source={require("@/assets/images/417.Touch-Screen.png")}
                            style={[
                                styles.comingSoonImage,
                                colorScheme === 'dark' && styles.invertedImage
                            ]}
                            resizeMode="contain"
                        />
                        <ThemedText type="subtitle" style={styles.comingSoonTitle}>
                            Coming Soon
                        </ThemedText>
                        <ThemedText type="default" style={styles.comingSoonDescription}>
                            We're working on bringing you powerful analytics and insights. Check back soon!
                        </ThemedText>

                        <View style={styles.badge}>
                            <Feather name="trending-up" size={20} color={ThemedColor.primary} />
                            <ThemedText type="defaultSemiBold" style={styles.badgeText}>
                                In Development
                            </ThemedText>
                        </View>
                    </View>
                </View>
            </View>
        </DrawerLayout>
    );
};

export default Daily;

const styles = StyleSheet.create({
    container: {
        paddingTop: Dimensions.get("screen").height * 0.09,
        paddingHorizontal: HORIZONTAL_PADDING,
    },
    headerContainer: {
        paddingTop: 20,
        flexDirection: "row",
        justifyContent: "center",
    },
    title: {
        fontWeight: "600",
    },
    dayOfWeek: {
        marginTop: 4,
        marginBottom: 8,
    },
    comingSoonContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        marginTop: -150,
    },
    comingSoonContent: {
        alignItems: "center",
        paddingHorizontal: 20,
    },
    comingSoonImage: {
        width: 200,
        height: 200,
        marginBottom: 24,
        opacity: 0.9,
    },
    invertedImage: {
        tintColor: '#ffffff',
    },
    comingSoonTitle: {
        fontSize: 28,
        fontWeight: "700",
        marginBottom: 12,
        textAlign: "center",
    },
    comingSoonDescription: {
        fontSize: 16,
        opacity: 0.7,
        textAlign: "center",
        lineHeight: 24,
        maxWidth: 280,
        marginBottom: 32,
    },
    badge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(100, 100, 255, 0.1)",
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 8,
    },
    badgeText: {
        fontSize: 14,
        opacity: 0.8,
    },
});

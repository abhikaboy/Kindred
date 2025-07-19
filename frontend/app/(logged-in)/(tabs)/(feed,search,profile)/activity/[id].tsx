import { Dimensions, StyleSheet, Text, View, ScrollView, TouchableOpacity } from "react-native";
import React, { useState } from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import ActivityPoint from "@/components/profile/ActivityPoint";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { useSafeAreaInsets } from "react-native-safe-area-context";
type Props = {};

const month_to_days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const month_names = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];

const Activity = (props: Props) => {
    const ThemedColor = useThemeColor();
    const [year, setYear] = useState(new Date().getFullYear());
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const insets = useSafeAreaInsets();
    const styles = stylesheet(ThemedColor);

    const setYearWithinBounds = (year: number) => {
        if (year < 2024) {
            setYear(2024);
        } else if (year > new Date().getFullYear()) {
            setYear(new Date().getFullYear());
        } else {
            setYear(year);
        }
    };

    return (
        <ThemedView style={{ paddingTop: insets.top }}>
            <ScrollView contentContainerStyle={styles.scrollViewContent} style={styles.scrollView}>
                <ThemedText type="title" style={styles.title}>
                    Activity
                </ThemedText>
                <ThemedText type="lightBody" style={styles.subtitle}>
                    Showing Coffee's activity for this year
                </ThemedText>

                <View style={styles.yearSelector}>
                    <TouchableOpacity onPress={() => setYearWithinBounds(year - 1)}>
                        <Ionicons name="chevron-back" size={24} color={ThemedColor.text} />
                    </TouchableOpacity>
                    <View style={styles.yearContainer}>
                        <Ionicons name="calendar" size={24} color={ThemedColor.text} />
                        <ThemedText type="lightBody">{year}</ThemedText>
                    </View>
                    <TouchableOpacity onPress={() => setYearWithinBounds(year + 1)}>
                        <Ionicons name="chevron-forward" size={24} color={ThemedColor.text} />
                    </TouchableOpacity>
                </View>
                <View style={styles.dataContainer}>
                    {month_names.map((month, index) => (
                        <View style={styles.monthContainer}>
                            <ThemedText type="subtitle">{month}</ThemedText>
                            <View>
                                <View style={styles.activityPointsContainer}>
                                    {new Array(month_to_days[index]).fill(0).map((item, index) => (
                                        <ActivityPoint key={index} level={Math.floor(Math.random() * 4) + 1} />
                                    ))}
                                </View>
                            </View>
                        </View>
                    ))}
                </View>
            </ScrollView>
        </ThemedView>
    );
};

export default Activity;

const stylesheet = (ThemedColor: any) =>
    StyleSheet.create({
        scrollViewContent: {
            gap: 16,
            paddingHorizontal: HORIZONTAL_PADDING,
        },
        scrollView: {
            flex: 1,
            flexDirection: "column",
        },
        title: {
            textAlign: "center",
            fontWeight: "bold",
        },
        subtitle: {
            textAlign: "center",
        },
        yearSelector: {
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            justifyContent: "space-between",
            borderWidth: 1,
            borderRadius: 24,
            padding: 8,
            borderColor: ThemedColor.text,
        },
        yearContainer: {
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
        },
        monthContainer: {
            marginTop: 24,
            gap: 16,
            alignSelf: "center",
        },
        activityPointsContainer: {
            flexWrap: "wrap",
            gap: 8,
            flexDirection: "row",
            width: "100%",
        },
        dataContainer: {
            flexDirection: "column-reverse",
            gap: 16,
            width: "100%",
            alignItems: "center",
        },
    });

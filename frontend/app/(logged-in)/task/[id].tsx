import { Dimensions, StyleSheet, Text, View } from "react-native";
import React, { useState } from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import TaskTabs from "@/components/inputs/TaskTabs";
import { useLocalSearchParams } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";
import DataCard from "@/components/task/DataCard";
import { HORIZONTAL_PADDING } from "@/constants/spacing";

export default function Task() {
    const [activeTab, setActiveTab] = useState(0);
    const { name, id } = useLocalSearchParams();
    let ThemedColor = useThemeColor();
    return (
        <ThemedView
            style={{
                flex: 1,
                paddingTop: Dimensions.get("screen").height * 0.12,
                paddingHorizontal: HORIZONTAL_PADDING,
                gap: 16,
            }}>
            <ThemedText type="heading">{name}</ThemedText>
            <TaskTabs tabs={["Details", "Timer"]} activeTab={activeTab} setActiveTab={setActiveTab} />
            <DataCard title="Notes" content="Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed non risus." />
            <DataCard title="Checklist" content="" />
            <DataCard title="Start Time">
                <View
                    style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                    }}>
                    <ThemedText type="lightBody">{new Date().toLocaleTimeString()}</ThemedText>
                    <ThemedText type="lightBody">{new Date().toLocaleTimeString()}</ThemedText>
                </View>
            </DataCard>
            <DataCard title="Deadline">
                <View
                    style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                    }}>
                    <ThemedText type="lightBody">{new Date().toLocaleTimeString()}</ThemedText>
                    <ThemedText type="lightBody">{new Date().toLocaleTimeString()}</ThemedText>
                </View>
            </DataCard>
        </ThemedView>
    );
}

const styles = StyleSheet.create({});

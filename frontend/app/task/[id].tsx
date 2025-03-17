import { Dimensions, StyleSheet, Text, View } from "react-native";
import React, { useState } from "react";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import TaskTabs from "@/components/inputs/TaskTabs";
import { useLocalSearchParams } from "expo-router";

export default function Task() {
    const [activeTab, setActiveTab] = useState(0);
    const { name, id } = useLocalSearchParams();
    return (
        <ThemedView style={{ flex: 1, paddingTop: Dimensions.get("screen").height * 0.13, paddingHorizontal: 24 }}>
            <ThemedText type="heading">{name}</ThemedText>
            <TaskTabs tabs={["Details", "Timer"]} activeTab={activeTab} setActiveTab={setActiveTab} />
        </ThemedView>
    );
}

const styles = StyleSheet.create({});

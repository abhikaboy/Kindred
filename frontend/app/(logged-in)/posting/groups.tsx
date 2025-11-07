import React, { useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, RefreshControl } from "react-native";
import { router } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useThemeColor } from "@/hooks/useThemeColor";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import GroupListItem from "@/components/posting/GroupListItem";
import GroupInfoBanner from "@/components/posting/GroupInfoBanner";
import { useGroups } from "@/hooks/useGroups";
import { useSelectedGroup } from "@/contexts/SelectedGroupContext";
import { Ionicons } from "@expo/vector-icons";

export default function GroupSelection() {
    const ThemedColor = useThemeColor();
    const { groups, isLoading, refresh } = useGroups();
    const [refreshing, setRefreshing] = useState(false);
    const { selectedGroupId, setSelectedGroup } = useSelectedGroup();

    const handleBack = () => {
        router.back();
    };

    const handleGroupPress = (groupId: string, groupName: string) => {
        setSelectedGroup(groupId, groupName);
    };

    const handleAllFriendsPress = () => {
        setSelectedGroup(null, null);
    };

    const handleConfirm = () => {
        // Group selection is stored in zustand, so just go back
        router.back();
    };

    const handleNewGroup = () => {
        router.push("/(logged-in)/posting/newgroup");
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await refresh();
        setRefreshing(false);
    };

    return (
        <ThemedView style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                {/* Header */}
                <View 
                    style={[
                        styles.header,
                        { 
                            borderBottomWidth: 1,
                            borderBottomColor: ThemedColor.lightened,
                        }
                    ]}
                >
                    <TouchableOpacity 
                        onPress={handleBack} 
                        style={styles.backButton}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="arrow-back" size={20} color={ThemedColor.text} />
                    </TouchableOpacity>
                    <ThemedText type="subtitle" style={styles.headerTitle}>Groups</ThemedText>
                    <View style={styles.headerSpacer} />
                </View>

                {/* Info Banner */}
                <GroupInfoBanner />

                {/* Groups List */}
                <ScrollView 
                    style={styles.scrollView}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={ThemedColor.primary}
                            colors={[ThemedColor.primary]}
                        />
                    }
                >
                    {isLoading && !refreshing ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={ThemedColor.primary} />
                        </View>
                    ) : (
                        <>
                            {/* All Friends - Always Available */}
                            <GroupListItem
                                groupName="All Friends"
                                members={[]}
                                memberCount={20} // TODO: Get actual friend count
                                isSelected={selectedGroupId === null}
                                onPress={handleAllFriendsPress}
                            />

                {/* User's Groups */}
                {groups.filter(group => group?._id).map((group) => (
                    <GroupListItem
                        key={group._id}
                        groupName={group?.name || "Unnamed Group"}
                        members={group?.members || []}
                        memberCount={(group?.members || []).length}
                        isSelected={selectedGroupId === group._id}
                        onPress={() => handleGroupPress(group._id, group?.name || "Unnamed Group")}
                    />
                ))}

                            {/* New Group Button */}
                            <TouchableOpacity
                                style={[
                                    styles.newGroupButton,
                                    {
                                        borderBottomWidth: 1,
                                        borderBottomColor: ThemedColor.lightened,
                                    }
                                ]}
                                onPress={handleNewGroup}
                                activeOpacity={0.7}
                            >
                                <ThemedText type="lightBody" style={styles.newGroupText}>
                                    + New Group
                                </ThemedText>
                            </TouchableOpacity>
                        </>
                    )}
                </ScrollView>

                {/* Confirm Button */}
                <View style={styles.buttonContainer}>
                    <PrimaryButton
                        title="Confirm"
                        onPress={handleConfirm}
                    />
                </View>
            </SafeAreaView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    safeArea: {
        flex: 1,
        paddingTop: 32,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 24,
        paddingVertical: 24,
        gap: 10,
    },
    backButton: {
        justifyContent: "center",
    },
    headerTitle: {
        textAlign: "center",
        flex: 1,
    },
    headerSpacer: {
        width: 20, // Match back button width for centering
    },
    scrollView: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingVertical: 40,
    },
    newGroupButton: {
        paddingVertical: 30,
        paddingHorizontal: 27,
        minHeight: 79,
        justifyContent: "center",
    },
    newGroupText: {
        // Using lightBody type via ThemedText
    },
    buttonContainer: {
        paddingHorizontal: 24,
        paddingVertical: 16,
    },
});


import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, TextInput, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useThemeColor } from "@/hooks/useThemeColor";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import UserInfoRowBase from "@/components/UserInfo/UserInfoRowBase";
import { useGroups } from "@/hooks/useGroups";
import { getFriendsAPI, type UserExtendedReference } from "@/api/connection";
import { Ionicons } from "@expo/vector-icons";

export default function NewGroup() {
    const ThemedColor = useThemeColor();
    const { createNewGroup, isCreating } = useGroups();
    const [groupName, setGroupName] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
    const [friends, setFriends] = useState<UserExtendedReference[]>([]);
    const [loadingFriends, setLoadingFriends] = useState(true);

    useEffect(() => {
        loadFriends();
    }, []);

    const loadFriends = async () => {
        try {
            setLoadingFriends(true);
            const friendsList = await getFriendsAPI();
            setFriends(friendsList);
        } catch (error) {
            console.error("Failed to load friends:", error);
        } finally {
            setLoadingFriends(false);
        }
    };

    const handleBack = () => {
        router.back();
    };

    const toggleMemberSelection = (memberId: string) => {
        const newSelected = new Set(selectedMembers);
        if (newSelected.has(memberId)) {
            newSelected.delete(memberId);
        } else {
            newSelected.add(memberId);
        }
        setSelectedMembers(newSelected);
    };

    const handleCreateGroup = async () => {
        if (!groupName.trim()) {
            console.log('⚠️ newgroup: Group name is empty, aborting');
            return;
        }

        const groupData = {
            name: groupName.trim(),
            members: Array.from(selectedMembers),
        };
        
        console.log('🟡 newgroup: Creating group with data:', groupData);

        try {
            const result = await createNewGroup(groupData);
            console.log('🟡 newgroup: Group created successfully:', result);
            router.back();
        } catch (error) {
            console.error("🔴 newgroup: Failed to create group:", error);
            // Error toast is handled by the hook
        }
    };

    // Filter friends based on search query
    const filteredFriends = friends.filter(
        (friend) =>
            friend.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            friend.handle.toLowerCase().includes(searchQuery.toLowerCase())
    );

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
                        },
                    ]}
                >
                    <TouchableOpacity onPress={handleBack} style={styles.backButton} activeOpacity={0.7}>
                        <Ionicons name="arrow-back" size={20} color={ThemedColor.text} />
                    </TouchableOpacity>
                    <ThemedText type="subtitle" style={styles.headerTitle}>
                        New Group
                    </ThemedText>
                    <View style={styles.headerSpacer} />
                </View>

                {/* Group Name Input */}
                <View style={styles.groupNameContainer}>
                    <TextInput
                        style={[
                            styles.groupNameInput,
                            {
                                color: ThemedColor.text,
                            },
                        ]}
                        placeholder="Enter Group Name..."
                        placeholderTextColor={ThemedColor.caption}
                        value={groupName}
                        onChangeText={setGroupName}
                        autoFocus={false}
                    />
                </View>

                {/* Search Input */}
                <View style={styles.searchContainer}>
                    <View
                        style={[
                            styles.searchInput,
                            {
                                backgroundColor: ThemedColor.lightened,
                            },
                        ]}
                    >
                        <TextInput
                            style={[
                                styles.searchInputText,
                                {
                                    color: ThemedColor.text,
                                },
                            ]}
                            placeholder="Search for your friends..."
                            placeholderTextColor={ThemedColor.caption}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>
                </View>

                {/* Friends List */}
                <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                    {loadingFriends ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={ThemedColor.primary} />
                        </View>
                    ) : filteredFriends.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <ThemedText type="caption">
                                {searchQuery ? "No friends found" : "No friends to add"}
                            </ThemedText>
                        </View>
                    ) : (
                        <View style={styles.friendsList}>
                            {filteredFriends.map((friend) => (
                                <TouchableOpacity
                                    key={friend._id}
                                    style={styles.friendRow}
                                    onPress={() => toggleMemberSelection(friend._id)}
                                    activeOpacity={0.7}
                                >
                                    <UserInfoRowBase
                                        name={friend.display_name}
                                        username={`@${friend.handle}`}
                                        icon={friend.profile_picture || ""}
                                        id={undefined} // Disable navigation
                                        right={
                                            selectedMembers.has(friend._id) ? (
                                                <Ionicons name="checkmark" size={20} color={ThemedColor.primary} />
                                            ) : null
                                        }
                                    />
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </ScrollView>

                {/* Create Button */}
                <View style={styles.buttonContainer}>
                    <PrimaryButton 
                        title={isCreating ? "Creating..." : "Create Group"} 
                        onPress={handleCreateGroup} 
                        disabled={!groupName.trim() || isCreating} 
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
        gap: 16,
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
        flex: 1,
    },
    headerSpacer: {
        width: 20,
    },
    groupNameContainer: {
        paddingHorizontal: 20,
        paddingVertical: 10,
    },
    groupNameInput: {
        fontSize: 20,
        fontFamily: "OutfitLight",
        padding: 0,
    },
    searchContainer: {
        paddingHorizontal: 20,
    },
    searchInput: {
        borderRadius: 29,
        paddingHorizontal: 24,
        paddingVertical: 14,
    },
    searchInputText: {
        fontSize: 14,
        fontFamily: "OutfitLight",
    },
    scrollView: {
        flex: 1,
    },
    friendsList: {
        gap: 16,
        paddingHorizontal: 20,
    },
    friendRow: {
        // No additional styling needed, UserInfoRowBase handles it
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingVertical: 40,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingVertical: 40,
    },
    buttonContainer: {
        paddingHorizontal: 20,
        paddingBottom: 16,
    },
});


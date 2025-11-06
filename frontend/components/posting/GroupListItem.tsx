import React from "react";
import { View, TouchableOpacity, StyleSheet, Image } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Ionicons } from "@expo/vector-icons";

interface GroupMember {
    _id: string;
    profile_picture?: string;
}

interface GroupListItemProps {
    groupName: string;
    members: GroupMember[];
    memberCount?: number;
    isSelected?: boolean;
    onPress: () => void;
}

export default function GroupListItem({ 
    groupName, 
    members, 
    memberCount,
    isSelected = false, 
    onPress 
}: GroupListItemProps) {
    const ThemedColor = useThemeColor();
    
    // Show up to 3 member avatars plus count if more
    const displayMembers = members.slice(0, 3);
    const remainingCount = (memberCount || members.length) - displayMembers.length;

    return (
        <TouchableOpacity
            style={[
                styles.container,
                { 
                    borderBottomWidth: 1,
                    borderBottomColor: ThemedColor.lightened,
                }
            ]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <View style={styles.leftContent}>
                {/* Member Avatars */}
                <View style={styles.avatarStack}>
                    {displayMembers.map((member, index) => (
                        <View
                            key={member._id}
                            style={[
                                styles.avatar,
                                {
                                    backgroundColor: ThemedColor.lightened,
                                    borderColor: ThemedColor.background,
                                    left: index * 16,
                                }
                            ]}
                        >
                            {member.profile_picture ? (
                                <Image 
                                    source={{ uri: member.profile_picture }} 
                                    style={styles.avatarImage}
                                />
                            ) : null}
                        </View>
                    ))}
                    
                    {remainingCount > 0 && (
                        <View
                            style={[
                                styles.avatar,
                                styles.countBadge,
                                {
                                    backgroundColor: ThemedColor.lightened,
                                    borderColor: ThemedColor.background,
                                    left: displayMembers.length * 16,
                                }
                            ]}
                        >
                            <ThemedText type="caption" style={styles.countText}>
                                +{remainingCount}
                            </ThemedText>
                        </View>
                    )}
                </View>

                {/* Group Name */}
                <ThemedText type="lightBody" style={styles.groupName}>
                    {groupName}
                </ThemedText>
            </View>

            {/* Check Icon */}
            {isSelected && (
                <Ionicons 
                    name="checkmark" 
                    size={24} 
                    color={ThemedColor.primary} 
                />
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 16,
        paddingHorizontal: 18,
        minHeight: 79,
    },
    leftContent: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
    },
    avatarStack: {
        flexDirection: "row",
        position: "relative",
        width: 119, // Accounts for 3 avatars + potential count badge
        height: 48,
        marginRight: 12,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 200,
        borderWidth: 2,
        position: "absolute",
        overflow: "hidden",
    },
    avatarImage: {
        width: "100%",
        height: "100%",
    },
    countBadge: {
        justifyContent: "center",
        alignItems: "center",
    },
    countText: {
        // Using caption type via ThemedText
    },
    groupName: {
        // Using default type via ThemedText
    },
});


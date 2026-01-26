import React, { useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getBlockedUsers, unblockUser, BlockedUser } from '@/api/connection';
import { showToast } from '@/utils/showToast';
import { router } from 'expo-router';
import { X } from 'phosphor-react-native';

export default function BlockedUsersScreen() {
    const ThemedColor = useThemeColor();
    const queryClient = useQueryClient();
    const [unblockingUserId, setUnblockingUserId] = useState<string | null>(null);

    const { data: blockedUsers = [], isLoading, error } = useQuery({
        queryKey: ['blockedUsers'],
        queryFn: getBlockedUsers,
    });

    const handleUnblock = async (user: BlockedUser) => {
        setUnblockingUserId(user._id);
        try {
            await unblockUser(user._id);
            showToast(`${user.name} has been unblocked`, 'success');
            
            // Invalidate queries to refresh
            queryClient.invalidateQueries({ queryKey: ['blockedUsers'] });
            queryClient.invalidateQueries({ queryKey: ['posts'] });
            queryClient.invalidateQueries({ queryKey: ['friendsPosts'] });
        } catch (error) {
            console.error('Failed to unblock user:', error);
            showToast('Failed to unblock user. Please try again.', 'danger');
        } finally {
            setUnblockingUserId(null);
        }
    };

    const renderBlockedUser = ({ item }: { item: BlockedUser }) => (
        <View style={[styles.userCard, { backgroundColor: ThemedColor.card, borderColor: ThemedColor.border }]}>
            <View style={styles.userInfo}>
                <View style={[styles.avatar, { backgroundColor: ThemedColor.primary + '20' }]}>
                    <ThemedText type="defaultSemiBold" style={{ color: ThemedColor.primary }}>
                        {item.name.charAt(0).toUpperCase()}
                    </ThemedText>
                </View>
                <View style={styles.userDetails}>
                    <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
                    <ThemedText type="caption" style={{ color: ThemedColor.caption }}>
                        @{item.handle}
                    </ThemedText>
                </View>
            </View>
            
            <TouchableOpacity
                style={[styles.unblockButton, { backgroundColor: ThemedColor.primary }]}
                onPress={() => handleUnblock(item)}
                disabled={unblockingUserId === item._id}
            >
                {unblockingUserId === item._id ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                    <ThemedText type="defaultSemiBold" style={styles.unblockButtonText}>
                        Unblock
                    </ThemedText>
                )}
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: ThemedColor.background }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <X size={24} color={ThemedColor.text} weight="bold" />
                </TouchableOpacity>
                <ThemedText type="defaultSemiBold" style={styles.headerTitle}>
                    Blocked Users
                </ThemedText>
                <View style={styles.placeholder} />
            </View>

            {isLoading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={ThemedColor.primary} />
                </View>
            ) : error ? (
                <View style={styles.centerContainer}>
                    <ThemedText type="default" style={{ color: ThemedColor.error }}>
                        Failed to load blocked users
                    </ThemedText>
                </View>
            ) : blockedUsers.length === 0 ? (
                <View style={styles.centerContainer}>
                    <ThemedText type="subtitle" style={{ color: ThemedColor.caption, textAlign: 'center' }}>
                        No Blocked Users
                    </ThemedText>
                    <ThemedText type="default" style={{ color: ThemedColor.caption, textAlign: 'center', marginTop: 8 }}>
                        Users you block will appear here
                    </ThemedText>
                </View>
            ) : (
                <FlatList
                    data={blockedUsers}
                    renderItem={renderBlockedUser}
                    keyExtractor={(item) => item._id}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 16,
        paddingTop: 60,
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 20,
    },
    placeholder: {
        width: 40,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    listContent: {
        padding: 16,
        gap: 12,
    },
    userCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    userDetails: {
        flex: 1,
    },
    unblockButton: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        minWidth: 80,
        alignItems: 'center',
    },
    unblockButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
    },
});

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions, Alert, ScrollView, Linking, ActivityIndicator } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as StoreReview from 'expo-store-review';
import { deleteAccount } from '@/api/auth';
import { showToast } from '@/utils/showToast';
import { useContactConsent } from '@/hooks/useContactConsent';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsCard } from '@/components/settings/SettingsCard';
import { SettingsToggleRow } from '@/components/settings/SettingsToggleRow';
import { SettingsActionRow } from '@/components/settings/SettingsActionRow';
import SegmentedControl from '@/components/ui/SegmentedControl';
import { useUserSettings, useUpdateSettings, useUpdateCheckinFrequency } from '@/hooks/useSettings';
import { getCalendarConnections, disconnectCalendar } from '@/api/calendar';

const { width: screenWidth } = Dimensions.get('window');

export default function Settings() {
    const ThemedColor = useThemeColor();
    const router = useRouter();
    const { logout } = useAuth();
    const { hasConsent, resetConsent } = useContactConsent();
    const insets = useSafeAreaInsets();

    // Fetch user settings
    const { data: userSettings, isLoading: isLoadingSettings, error: settingsError } = useUserSettings();
    const { mutate: updateSettings, isPending: isUpdating } = useUpdateSettings();
    const { mutate: updateCheckinFreq } = useUpdateCheckinFrequency();

    // Local state for settings (synced with server data)
    const [localSettings, setLocalSettings] = useState({
        friendActivity: true,
        nearDeadlines: true,
        showTaskDetails: true,
        recentWorkspaces: true,
    });

    // Check-in frequency options
    const checkinFrequencyOptions = ['None', 'Occasionally', 'Regularly', 'Frequently'];
    const [checkinFrequency, setCheckinFrequency] = useState('Regularly');

    // Calendar integration state
    const [calendarConnections, setCalendarConnections] = useState<any[]>([]);
    const [isLoadingCalendar, setIsLoadingCalendar] = useState(false);

    // Sync local state with fetched settings
    useEffect(() => {
        if (userSettings) {
            setLocalSettings({
                friendActivity: userSettings.display?.friend_activity_feed ?? true,
                nearDeadlines: userSettings.display?.near_deadlines_widget ?? true,
                showTaskDetails: userSettings.display?.show_task_details ?? true,
                recentWorkspaces: userSettings.display?.recent_workspaces ?? true,
            });

            // Map backend frequency to display format
            const frequencyMap: Record<string, string> = {
                'none': 'None',
                'occasionally': 'Occasionally',
                'regularly': 'Regularly',
                'frequently': 'Frequently',
            };
            setCheckinFrequency(frequencyMap[userSettings.notifications?.checkin_frequency ?? 'regularly'] ?? 'Regularly');
        }
    }, [userSettings]);

    // Load calendar connections
    useEffect(() => {
        loadCalendarConnections();
    }, []);

    const loadCalendarConnections = async () => {
        try {
            const { connections } = await getCalendarConnections();
            setCalendarConnections(connections || []);
        } catch (error) {
            console.error('Error loading calendar connections:', error);
        }
    };

    const handleToggle = (key: keyof typeof localSettings) => {
        const newValue = !localSettings[key];
        setLocalSettings(prev => ({
            ...prev,
            [key]: newValue,
        }));

        // Immediately save to backend
        const settingKeyMap: Record<string, string> = {
            friendActivity: 'friend_activity_feed',
            nearDeadlines: 'near_deadlines_widget',
            showTaskDetails: 'show_task_details',
            recentWorkspaces: 'recent_workspaces',
        };

        updateSettings({
            display: {
                [settingKeyMap[key]]: newValue,
            },
        });
    };

    const handleCheckinFrequencyChange = (option: string) => {
        setCheckinFrequency(option);

        // Map display format to backend format
        const frequencyMap: Record<string, "none" | "occasionally" | "regularly" | "frequently"> = {
            'None': 'none',
            'Occasionally': 'occasionally',
            'Regularly': 'regularly',
            'Frequently': 'frequently',
        };

        const backendFrequency = frequencyMap[option];
        if (backendFrequency) {
            updateCheckinFreq(backendFrequency);
        }
    };

    const handleSave = () => {
        // Settings are auto-saved on change, but this can trigger a manual sync
        showToast('All settings are saved automatically', 'success');
    };

    const handleBack = () => {
        router.back();
    };

    const handleContactSupport = () => {
        // TODO: Implement contact support functionality
        console.log('Contact support pressed');
    };

    const handleRateKindred = async () => {
        try {
            // Check if store review is available on this platform
            const isAvailable = await StoreReview.isAvailableAsync();

            if (isAvailable) {
                // Request the native in-app review
                await StoreReview.requestReview();
            } else {
                // Fallback: show alert with option to go to store
                Alert.alert(
                    'Rate Kindred',
                    'We\'d love your feedback! Would you like to rate us in the app store?',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        {
                            text: 'Rate Now',
                            onPress: async () => {
                                const storeUrl = StoreReview.storeUrl();
                                if (storeUrl) {
                                    // This will open the app store
                                    const Linking = await import('expo-linking');
                                    await Linking.default.openURL(storeUrl);
                                } else {
                                    Alert.alert('Error', 'Unable to open app store at this time.');
                                }
                            }
                        }
                    ]
                );
            }
        } catch (error) {
            console.error('Error requesting store review:', error);
            Alert.alert(
                'Error',
                'Unable to open review at this time. Please try again later.'
            );
        }
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            'Delete Account',
            'Are you sure you want to permanently delete your account? This action cannot be undone and will delete all your data including tasks, categories, and friend connections.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete Account',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteAccount();
                            showToast('Account deleted successfully', 'success');
                            logout();
                            router.replace('/login');
                        } catch (error) {
                            console.error('Delete account error:', error);
                            showToast('Failed to delete account', 'danger');
                        }
                    }
                }
            ]
        );
    };

    const handleLogout = () => {
        Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: () => {
                        logout();
                        router.replace('/login');
                    }
                }
            ]
        );
    };

    const handleResetContactConsent = () => {
        const statusMessage = hasConsent === null
            ? 'You haven\'t been asked about syncing your phone contacts yet.\n\nWhen you tap "Sync Contacts" in the Search tab, you\'ll see a detailed explanation of how your phone contacts are used to help you find friends on Kindred.'
            : hasConsent === true
            ? 'Phone contact syncing is currently enabled.\n\nYour phone contact numbers are uploaded to our server to match with existing Kindred users and help you find friends.\n\nTap "Reset" to clear this preference and be asked again.'
            : 'Phone contact syncing is currently disabled.\n\nYou previously chose not to sync your phone contacts.\n\nTap "Reset" to clear this preference and be asked again when you try to sync contacts.';

        Alert.alert(
            'Phone Contacts',
            statusMessage,
            [
                { text: 'Cancel', style: 'cancel' },
                ...(hasConsent !== null ? [{
                    text: 'Reset Preference',
                    onPress: async () => {
                        try {
                            await resetConsent();
                            showToast('Contact sync preference reset', 'success');
                        } catch (error) {
                            console.error('Error resetting consent:', error);
                            showToast('Failed to reset preference', 'danger');
                        }
                    }
                }] : [])
            ]
        );
    };

    const handleDisconnectCalendar = (connection: any) => {
        Alert.alert(
            'Disconnect Google Calendar',
            `Are you sure you want to disconnect "${connection.provider_account_id}"?\n\nThis will remove the connection but keep your synced events as tasks.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Disconnect',
                    style: 'destructive',
                    onPress: async () => {
                        setIsLoadingCalendar(true);
                        try {
                            await disconnectCalendar(connection.id);
                            showToast('Google Calendar disconnected', 'success');
                            await loadCalendarConnections();
                        } catch (error) {
                            console.error('Error disconnecting calendar:', error);
                            showToast('Failed to disconnect calendar', 'danger');
                        } finally {
                            setIsLoadingCalendar(false);
                        }
                    }
                }
            ]
        );
    };


    const styles = createStyles(ThemedColor, screenWidth);

    // Show loading state
    if (isLoadingSettings) {
        return (
            <ThemedView style={styles.container}>
                <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                    <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                        <Ionicons name="chevron-back" size={24} color={ThemedColor.text} />
                    </TouchableOpacity>
                    <ThemedText type="defaultSemiBold" style={styles.headerTitle}>
                        Settings
                    </ThemedText>
                    <View style={styles.saveButton} />
                </View>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={ThemedColor.primary} />
                    <ThemedText style={{ marginTop: 16, color: ThemedColor.caption }}>
                        Loading settings...
                    </ThemedText>
                </View>
            </ThemedView>
        );
    }

    // Show error state
    if (settingsError) {
        return (
            <ThemedView style={styles.container}>
                <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                    <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                        <Ionicons name="chevron-back" size={24} color={ThemedColor.text} />
                    </TouchableOpacity>
                    <ThemedText type="defaultSemiBold" style={styles.headerTitle}>
                        Settings
                    </ThemedText>
                    <View style={styles.saveButton} />
                </View>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                    <Ionicons name="alert-circle-outline" size={48} color={ThemedColor.error} />
                    <ThemedText style={{ marginTop: 16, color: ThemedColor.text, textAlign: 'center' }}>
                        Failed to load settings
                    </ThemedText>
                    <ThemedText style={{ marginTop: 8, color: ThemedColor.caption, textAlign: 'center' }}>
                        Please try again later
                    </ThemedText>
                </View>
            </ThemedView>
        );
    }

    return (
        <ThemedView style={styles.container}>
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color={ThemedColor.text} />
                </TouchableOpacity>

                <ThemedText type="defaultSemiBold" style={styles.headerTitle}>
                    Settings
                </ThemedText>

                <TouchableOpacity
                    onPress={handleSave}
                    style={styles.saveButton}
                    disabled={isUpdating}
                >
                    {isUpdating ? (
                        <ActivityIndicator size="small" color={ThemedColor.text} />
                    ) : (
                        <ThemedText type="defaultSemiBold" style={styles.saveText}>
                            Save
                        </ThemedText>
                    )}
                </TouchableOpacity>
            </View>

            {/* Scrollable Content */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 44 }]}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.content}>
                <SettingsSection title="NOTIFICATIONS">
                    <View style={styles.checkinSection}>
                        <ThemedText type="lightBody" style={[styles.settingLabel, { color: ThemedColor.caption }]}>
                            Check-in Frequency
                        </ThemedText>
                        <ThemedText type="caption" style={[styles.checkinDescription, { color: ThemedColor.text + '80' }]}>
                            How often you'd like reminders about overdue tasks
                        </ThemedText>
                        <SegmentedControl
                            options={checkinFrequencyOptions}
                            selectedOption={checkinFrequency}
                            onOptionPress={handleCheckinFrequencyChange}
                            size="small"
                        />
                    </View>
                </SettingsSection>

                <SettingsSection title="DISPLAY">
                    <SettingsCard>
                        <SettingsToggleRow
                            label="Friend Activity"
                            value={localSettings.friendActivity}
                            onValueChange={() => handleToggle('friendActivity')}
                        />
                        <SettingsToggleRow
                            label="Near Deadlines"
                            value={localSettings.nearDeadlines}
                            onValueChange={() => handleToggle('nearDeadlines')}
                        />
                        <SettingsToggleRow
                            label="Show Task Details"
                            value={localSettings.showTaskDetails}
                            onValueChange={() => handleToggle('showTaskDetails')}
                        />
                        <SettingsToggleRow
                            label="Recent Workspaces"
                            value={localSettings.recentWorkspaces}
                            onValueChange={() => handleToggle('recentWorkspaces')}
                        />
                    </SettingsCard>
                </SettingsSection>

                <SettingsSection title="INTEGRATIONS">
                    {calendarConnections.length > 0 ? (
                        <SettingsCard>
                            {calendarConnections.map((connection, index) => (
                                <TouchableOpacity
                                    key={connection.id}
                                    style={[
                                        styles.integrationRow,
                                        index < calendarConnections.length - 1 && {
                                            borderBottomWidth: StyleSheet.hairlineWidth,
                                            borderBottomColor: ThemedColor.tertiary,
                                        }
                                    ]}
                                    onPress={() => handleDisconnectCalendar(connection)}
                                    activeOpacity={0.7}
                                    disabled={isLoadingCalendar}
                                >
                                    <View style={styles.integrationIconContainer}>
                                        <Ionicons name="calendar" size={24} color={ThemedColor.primary} />
                                    </View>
                                    <View style={styles.integrationContent}>
                                        <View style={styles.integrationHeader}>
                                            <ThemedText type="defaultSemiBold" style={{ color: ThemedColor.text }}>
                                                Google Calendar
                                            </ThemedText>
                                            <View style={[
                                                styles.connectedBadge,
                                                { backgroundColor: ThemedColor.primary + '15' }
                                            ]}>
                                                <View style={[styles.connectedDot, { backgroundColor: ThemedColor.primary }]} />
                                                <ThemedText type="caption" style={[
                                                    styles.connectedText,
                                                    { color: ThemedColor.primary }
                                                ]}>
                                                    Connected
                                                </ThemedText>
                                            </View>
                                        </View>
                                        <ThemedText type="smallerDefault" style={{ color: ThemedColor.caption, marginTop: 2 }}>
                                            {connection.provider_account_id}
                                        </ThemedText>
                                    </View>
                                    <View style={styles.integrationAction}>
                                        {isLoadingCalendar ? (
                                            <ActivityIndicator size="small" color={ThemedColor.caption} />
                                        ) : (
                                            <Ionicons name="link-outline" size={22} color={ThemedColor.caption} style={{ transform: [{ rotate: '-45deg' }] }} />
                                        )}
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </SettingsCard>
                    ) : (
                        <SettingsCard>
                            <View style={styles.emptyIntegrationRow}>
                                <View style={[styles.emptyIconContainer, { backgroundColor: ThemedColor.tertiary }]}>
                                    <Ionicons name="link-outline" size={20} color={ThemedColor.caption} />
                                </View>
                                <View style={styles.emptyContent}>
                                    <ThemedText type="defaultSemiBold" style={{ color: ThemedColor.text }}>
                                        No integrations
                                    </ThemedText>
                                    <ThemedText type="smallerDefault" style={{ color: ThemedColor.caption, marginTop: 2 }}>
                                        Connect Google Calendar from the home screen
                                    </ThemedText>
                                </View>
                            </View>
                        </SettingsCard>
                    )}
                </SettingsSection>

                <SettingsSection title="PRIVACY & DATA">
                    <SettingsCard>
                        <TouchableOpacity
                            style={styles.privacyRow}
                            onPress={handleResetContactConsent}
                            activeOpacity={0.7}
                        >
                            <View style={styles.privacyInfo}>
                                <View style={styles.privacyTitleRow}>
                                    <ThemedText type="lightBody" style={[styles.settingLabel, { color: ThemedColor.caption }]}>
                                        Phone Contacts
                                    </ThemedText>
                                    <View style={[
                                        styles.statusBadge,
                                        {
                                            backgroundColor: hasConsent === true
                                                ? ThemedColor.primary + '20'
                                                : ThemedColor.tertiary
                                        }
                                    ]}>
                                        <ThemedText type="caption" style={[
                                            styles.statusBadgeText,
                                            {
                                                color: hasConsent === true
                                                    ? ThemedColor.primary
                                                    : ThemedColor.text + 'AA'
                                            }
                                        ]}>
                                            {hasConsent === null && 'Not Set'}
                                            {hasConsent === true && 'Enabled'}
                                            {hasConsent === false && 'Disabled'}
                                        </ThemedText>
                                    </View>
                                </View>
                                <ThemedText type="caption" style={[styles.privacyDescription, { color: ThemedColor.text + '80' }]}>
                                    {hasConsent === null && 'Sync contacts to find friends'}
                                    {hasConsent === true && 'Contacts are synced'}
                                    {hasConsent === false && 'Contact sync disabled'}
                                </ThemedText>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={ThemedColor.text + '60'} />
                        </TouchableOpacity>
                    </SettingsCard>

                    <SettingsActionRow
                        label="Blocked Users"
                        onPress={() => router.push('/(logged-in)/(tabs)/(task)/blocked-users')}
                        icon="ban-outline"
                    />
                </SettingsSection>

                <SettingsSection title="RESOURCES">
                    <SettingsActionRow
                        label="Contact Support"
                        onPress={handleContactSupport}
                    />
                    <SettingsActionRow
                        label="Rate Kindred"
                        onPress={handleRateKindred}
                        icon="star-outline"
                    />
                </SettingsSection>

                <SettingsSection title="LEGAL">
                    <SettingsActionRow
                        label="Privacy Policy"
                        onPress={() => Linking.openURL('https://beaker.notion.site/Kindred-Privacy-Policy-2afa5d52691580a7ac51d34b8e0f427a')}
                        icon="open-outline"
                        iconColor={ThemedColor.text + '60'}
                    />
                    <SettingsActionRow
                        label="Terms & Conditions"
                        onPress={() => Linking.openURL('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/')}
                        icon="open-outline"
                        iconColor={ThemedColor.text + '60'}
                    />
                </SettingsSection>

                <SettingsSection title="ACCOUNT" marginBottom={20}>
                    <SettingsActionRow
                        label="Delete Account"
                        onPress={handleDeleteAccount}
                        icon="trash-outline"
                        iconColor={ThemedColor.error}
                    />
                    <SettingsActionRow
                        label="Logout"
                        onPress={handleLogout}
                        icon="log-out-outline"
                        iconColor={ThemedColor.error}
                    />
                </SettingsSection>
            </View>
            </ScrollView>
        </ThemedView>
    );
}

const createStyles = (ThemedColor: any, screenWidth: number) => {
    const horizontalPadding = Math.max(20, screenWidth * 0.05);

    return StyleSheet.create({
        container: {
            flex: 1,
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: horizontalPadding,
            paddingBottom: 16,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: ThemedColor.tertiary,
        },
        scrollView: {
            flex: 1,
        },
        scrollContent: {
            paddingTop: 24,
        },
        backButton: {
            minWidth: 40,
            alignItems: 'flex-start',
        },
        headerTitle: {
            flex: 1,
            textAlign: 'center',
        },
        saveButton: {
            minWidth: 40,
            alignItems: 'flex-end',
        },
        saveText: {
            color: ThemedColor.text,
        },
        content: {
            paddingHorizontal: horizontalPadding,
        },
        settingLabel: {
            flex: 1,
        },
        privacyRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 12,
            minHeight: 36,
        },
        privacyInfo: {
            flex: 1,
            gap: 6,
        },
        privacyTitleRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
        },
        statusBadge: {
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 6,
        },
        statusBadgeText: {
            fontSize: 11,
            fontWeight: '600',
        },
        privacyDescription: {
            fontSize: 12,
            lineHeight: 16,
        },
        checkinSection: {
            borderRadius: 12,
        },
        checkinDescription: {
            fontSize: 12,
            lineHeight: 16,
            marginTop: 4,
            marginBottom: 8,
        },
        integrationRow: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 8,
            gap: 12,
        },
        integrationIconContainer: {
            width: 32,
            height: 32,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
        },
        integrationContent: {
            flex: 1,
            gap: 2,
        },
        integrationHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        connectedBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 6,
            gap: 4,
        },
        connectedDot: {
            width: 6,
            height: 6,
            borderRadius: 3,
        },
        connectedText: {
            fontSize: 11,
            fontWeight: '500',
        },
        integrationAction: {
            width: 32,
            height: 32,
            alignItems: 'center',
            justifyContent: 'center',
        },
        emptyIntegrationRow: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 8,
            gap: 12,
        },
        emptyIconContainer: {
            width: 44,
            height: 44,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
        },
        emptyContent: {
            flex: 1,
            gap: 2,
        },
    });
};

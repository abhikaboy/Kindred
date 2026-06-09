import React, { useState, useCallback, useRef, useEffect } from "react";
import { ScrollView, View, Switch, TouchableOpacity, TextInput, RefreshControl, Animated } from "react-native";
import { MotiView } from "moti";
import { ThemedText } from "@/components/ThemedText";
import { WorkspaceDrawerItem } from "@/components/home/WorkspaceDrawerItem";
import DashboardCards from "@/components/dashboard/DashboardCards";
import DashboardStats from "@/components/dashboard/DashboardStats";
import BottomDashboardCards from "@/components/dashboard/BottomDashboardCards";
import BasicCard from "@/components/cards/BasicCard";
import { useRouter } from "expo-router";
import { KudosCards } from "../cards/KudosCard";
import { HorseIcon, PlusIcon } from "phosphor-react-native";
import SectionHeader from "./SectionHeader";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import TodaySection from "./TodaySection";
import RecentlyCompletedTasks from "./RecentlyCompletedTasks";
import WorkingOnRow from "./WorkingOnRow";
import { OnboardingChecklist } from "./OnboardingChecklist";
import Ionicons from "@expo/vector-icons/Ionicons";
import { GoogleCalendarCard } from "../cards/GoogleCalendarCard";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";
import { getCalendarConnections, connectGoogleCalendar, syncCalendarEvents, CalendarConnection } from "@/api/calendar";
import { useAlert } from "@/contexts/AlertContext";
import { formatErrorForAlert, ERROR_MESSAGES } from "@/utils/errorParser";
import CalendarSetupBottomSheet from "@/components/modals/CalendarSetupBottomSheet";
import { useUserSettings, useUpdateDashboardConfiguration, settingsKeys } from "@/hooks/useSettings";
import type { DashboardConfiguration, UserSettings } from "@/api/settings";
import { useQueryClient } from "@tanstack/react-query";

interface HomeScrollContentProps {
    encouragementCount: number;
    congratulationCount: number;
    workspaces: any[];
    displayWorkspaces: any[];
    fetchingWorkspaces: boolean;
    onWorkspaceSelect: (workspaceName: string) => void;
    onCreateWorkspace: () => void;
    drawerRef: any;
    ThemedColor: any;
    focusMode: boolean;
    toggleFocusMode: () => void;
    refreshing?: boolean;
    onRefresh?: () => void;
    scrollRef?: React.RefObject<ScrollView>;
    kudosRef?: React.RefObject<View>;
    onKudosLayout?: (layout: { y: number; height: number }) => void;
    onStatsExpandChange?: (expanded: boolean) => void;
    kudosOffsetRef: React.MutableRefObject<number>;
}

// Temporarily hidden from the dashboard (kept in code for easy re-enable).
// Flip to true to bring the KUDOS row back.
const SHOW_KUDOS_ROW = false;

export const HomeScrollContent: React.FC<HomeScrollContentProps> = ({
    encouragementCount,
    congratulationCount,
    workspaces,
    displayWorkspaces,
    fetchingWorkspaces,
    onWorkspaceSelect,
    onCreateWorkspace,
    drawerRef,
    ThemedColor,
    focusMode,
    toggleFocusMode,
    refreshing = false,
    onRefresh,
    scrollRef,
    kudosRef,
    onKudosLayout,
    onStatsExpandChange,
    kudosOffsetRef,
}) => {
    const router = useRouter();
    const { showAlert } = useAlert();
    const [statsExpanded, setStatsExpanded] = useState(false);
    const dimAnim = useRef(new Animated.Value(1)).current;

    // Dashboard section visibility
    const queryClient = useQueryClient();
    const { data: settings } = useUserSettings();
    const { mutate: saveDashboardConfig } = useUpdateDashboardConfiguration();
    const defaultConfig: DashboardConfiguration = {
        stats: true, jump_back_in: true, kudos: true, upcoming: true,
        google_calendar: true, recent_workspaces: true, recently_completed: true,
    };
    const dashboardConfig = settings?.dashboard_configuration ?? defaultConfig;

    // Debounced save: accumulate changes, update cache immediately, save to backend after delay
    const pendingChangesRef = useRef<Partial<DashboardConfiguration>>({});
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const toggleSection = useCallback((key: keyof DashboardConfiguration) => {
        const newValue = !dashboardConfig[key];
        pendingChangesRef.current = { ...pendingChangesRef.current, [key]: newValue };

        // Optimistic cache update (no network)
        queryClient.setQueryData(settingsKeys.user(), (old: UserSettings | undefined) => {
            if (!old) return old;
            return {
                ...old,
                dashboard_configuration: { ...defaultConfig, ...old.dashboard_configuration, [key]: newValue },
            };
        });

        // Debounce the actual network save
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            saveDashboardConfig(pendingChangesRef.current);
            pendingChangesRef.current = {};
        }, 600);
    }, [dashboardConfig, saveDashboardConfig, queryClient]);

    // Clean up debounce timer on unmount
    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, []);

    useEffect(() => {
        Animated.timing(dimAnim, {
            toValue: statsExpanded ? 0.15 : 1,
            duration: 250,
            useNativeDriver: true,
        }).start();
    }, [statsExpanded]);

    const handleStatsExpandChange = useCallback((expanded: boolean) => {
        setStatsExpanded(expanded);
        onStatsExpandChange?.(expanded);
    }, [onStatsExpandChange]);
    const [showGoogleCalendarCard, setShowGoogleCalendarCard] = React.useState(true);
    const [calendarLoading, setCalendarLoading] = React.useState(false);
    const [isCalendarLinked, setIsCalendarLinked] = React.useState(false);
    const [calendarConnection, setCalendarConnection] = React.useState<CalendarConnection | null>(null);
    const [showCalendarSetup, setShowCalendarSetup] = React.useState(false);
    const [pendingConnectionId, setPendingConnectionId] = React.useState<string | null>(null);

    // Check if user has dismissed the card or has a calendar connection
    React.useEffect(() => {
        const checkCalendarStatus = async () => {
            try {
                // Check if dismissed
                const dismissed = await AsyncStorage.getItem("google_calendar_card_dismissed");
                if (dismissed === "true") {
                    setShowGoogleCalendarCard(false);
                    return;
                }

                // Check for existing connections
                const { connections } = await getCalendarConnections();
                if (connections && connections.length > 0) {
                    const completed = connections.find((c) => c.setup_complete);
                    const pending = connections.find((c) => !c.setup_complete);

                    if (completed) {
                        setIsCalendarLinked(true);
                        setCalendarConnection(completed);
                        setShowGoogleCalendarCard(true);
                    } else if (pending) {
                        setIsCalendarLinked(false);
                        setCalendarConnection(null);
                        setPendingConnectionId(pending.id);
                        setShowCalendarSetup(true);
                        setShowGoogleCalendarCard(true);
                    }
                }
            } catch (error) {
                console.error("Error checking calendar status:", error);
            }
        };
        checkCalendarStatus();
    }, []);

    const handleCalendarAction = async () => {
        if (pendingConnectionId) {
            setShowCalendarSetup(true);
            return;
        }
        if (isCalendarLinked && calendarConnection) {
            // Sync events
            await handleSyncCalendar();
        } else {
            // Connect calendar
            await handleConnectCalendar();
        }
    };

    const handleConnectCalendar = async () => {
        setCalendarLoading(true);
        try {
            // Get OAuth URL from backend
            const { auth_url } = await connectGoogleCalendar();

            // Open OAuth flow in browser - pass 'kindred://' so iOS returns the redirect URL
            const result = await WebBrowser.openAuthSessionAsync(auth_url, 'kindred://');

            if (result.type === "success" && result.url) {
                // Parse connectionId from the redirect URL
                // Format: kindred://calendar/linked?connectionId=xxx
                const connIdMatch = result.url.match(/connectionId=([^&]+)/);
                const connId = connIdMatch?.[1];
                if (connId) {
                    setPendingConnectionId(connId);
                    setShowCalendarSetup(true);
                    return;
                }
            }

            // Fallback: refresh connection status (Android deep link flow)
            const { connections } = await getCalendarConnections();
            if (connections && connections.length > 0) {
                const completed = connections.find((c) => c.setup_complete);
                const pending = connections.find((c) => !c.setup_complete);

                if (completed) {
                    setIsCalendarLinked(true);
                    setCalendarConnection(completed);
                } else if (pending) {
                    setIsCalendarLinked(false);
                    setCalendarConnection(null);
                    setPendingConnectionId(pending.id);
                    setShowCalendarSetup(true);
                }
            }
        } catch (error) {
            console.error("Error connecting Google Calendar:", error);
            const errorInfo = formatErrorForAlert(error, ERROR_MESSAGES.CALENDAR_CONNECT_FAILED);
            showAlert({
                title: errorInfo.title,
                message: errorInfo.message,
                buttons: [{ text: "OK", style: "default" }],
            });
        } finally {
            setCalendarLoading(false);
        }
    };

    const handleCalendarSetupComplete = async (connectionId: string) => {
        setShowCalendarSetup(false);
        try {
            const result = await syncCalendarEvents(connectionId);
            const deletedText = result.tasks_deleted ? `\nDeleted: ${result.tasks_deleted}` : "";
            showAlert({
                title: "Calendar Linked!",
                message: `Successfully synced ${result.tasks_created} events.\n\nCreated: ${result.tasks_created}\nSkipped: ${result.tasks_skipped}${deletedText}\nTotal: ${result.events_total}`,
                buttons: [{ text: "OK", style: "default" }],
            });
            // Refresh connection status
            const { connections } = await getCalendarConnections();
            if (connections && connections.length > 0) {
                const completed = connections.find((c) => c.setup_complete);
                if (completed) {
                    setIsCalendarLinked(true);
                    setCalendarConnection(completed);
                }
            }
            if (onRefresh) onRefresh();
        } catch (error) {
            console.error("Error syncing calendar after setup:", error);
            const errorInfo = formatErrorForAlert(error, ERROR_MESSAGES.CALENDAR_SYNC_FAILED);
            showAlert({
                title: "Calendar Linked",
                message: `Your calendar was linked, but we couldn't sync events automatically.\n\n${errorInfo.message}\n\nYou can sync manually from the home page.`,
                buttons: [{ text: "OK", style: "default" }],
            });
        }
        setPendingConnectionId(null);
    };

    const handleSyncCalendar = async () => {
        if (!calendarConnection) return;

        setCalendarLoading(true);
        try {
            const result = await syncCalendarEvents(calendarConnection.id);

            const deletedText = result.tasks_deleted ? `\nDeleted: ${result.tasks_deleted}` : "";
            showAlert({
                title: "Sync Complete",
                message: `Synced ${result.tasks_created} events to "${result.workspace_name}" workspace.\n\nCreated: ${result.tasks_created}\nSkipped: ${result.tasks_skipped}${deletedText}\nTotal: ${result.events_total}`,
                buttons: [{ text: "OK", style: "default" }],
            });

            // Refresh tasks after sync
            if (onRefresh) {
                onRefresh();
            }
        } catch (error) {
            console.error("Error syncing calendar:", error);
            const errorInfo = formatErrorForAlert(error, ERROR_MESSAGES.CALENDAR_SYNC_FAILED);
            showAlert({
                title: errorInfo.title,
                message: errorInfo.message,
                buttons: [{ text: "OK", style: "default" }],
            });
        } finally {
            setCalendarLoading(false);
        }
    };

    const handleDismissGoogleCalendar = async () => {
        try {
            await AsyncStorage.setItem("google_calendar_card_dismissed", "true");
            setShowGoogleCalendarCard(false);
        } catch (error) {
            console.error("Error dismissing Google Calendar card:", error);
        }
    };

    const handleKudosLayout = (event: any) => {
        if (!onKudosLayout) return;
        const { y, height } = event.nativeEvent.layout;
        onKudosLayout({ y, height });
    };

    return (
        <ScrollView
            ref={scrollRef}
            style={{ gap: 16 }}
            contentContainerStyle={{ gap: 16 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
                onRefresh ? (
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={ThemedColor.primary}
                        colors={[ThemedColor.primary]}
                    />
                ) : undefined
            }
        >
            <MotiView style={{ gap: 16, marginTop: 0 }}>

                {/* Dashboard Stats - always visible */}
                <View style={{ marginHorizontal: HORIZONTAL_PADDING, marginBottom: 8, gap: 10 }}>
                    <DashboardStats onExpandChange={handleStatsExpandChange} />
                </View>
                {scrollRef && <OnboardingChecklist scrollRef={scrollRef as React.RefObject<ScrollView>} kudosOffsetRef={kudosOffsetRef} />}
                <WorkingOnRow />

                <Animated.View style={{ opacity: dimAnim }}>
                {/* Dashboard Cards */}
                <View style={{ marginLeft: HORIZONTAL_PADDING, gap: 12, marginBottom: 18 }}>
                    <View style={{ paddingRight: HORIZONTAL_PADDING }}>
                        <SectionHeader title="JUMP BACK IN" visible={dashboardConfig.jump_back_in} onToggleVisibility={() => toggleSection("jump_back_in")} />
                    </View>
                    {dashboardConfig.jump_back_in && <DashboardCards />}
                </View>

                {/* Kudos Cards (Encouragements & Congratulations) — temporarily hidden via SHOW_KUDOS_ROW */}
                {SHOW_KUDOS_ROW && (
                    <View
                        style={{
                            marginHorizontal: HORIZONTAL_PADDING,
                            gap: 12,
                            marginBottom: 18,
                        }}>
                        <SectionHeader title="KUDOS" visible={dashboardConfig.kudos} onToggleVisibility={() => toggleSection("kudos")} />
                        {dashboardConfig.kudos && (
                            <>
                                <ThemedText type="caption">Send more Kudos to get premium features.</ThemedText>
                                <View ref={kudosRef} onLayout={handleKudosLayout}>
                                    <KudosCards />
                                </View>
                            </>
                        )}
                    </View>
                )}

                <View style={{ marginHorizontal: HORIZONTAL_PADDING, gap: 12, marginBottom: 12, }}>
                    <TouchableOpacity onPress={() => router.push("/(logged-in)/(tabs)/(task)/today")}>
                        <SectionHeader
                            title="UPCOMING"
                            visible={dashboardConfig.upcoming}
                            onToggleVisibility={() => toggleSection("upcoming")}
                            right={<Ionicons name="chevron-forward" size={16} color={ThemedColor.caption} />}
                        />
                    </TouchableOpacity>
                    {dashboardConfig.upcoming && <TodaySection />}
                </View>

                {/* Google Calendar Connection Card */}
                {/* Once Google Calendar is linked, the whole section is hidden from the
                    home page — there's nothing left to prompt. (Sync still lives elsewhere.) */}
                {showGoogleCalendarCard && !isCalendarLinked && (
                    <View style={{ marginHorizontal: HORIZONTAL_PADDING, marginBottom: 18 }}>
                        <View style={{ marginBottom: 8 }}>
                            <SectionHeader title="GOOGLE CALENDAR" visible={dashboardConfig.google_calendar} onToggleVisibility={() => toggleSection("google_calendar")} />
                        </View>
                        {dashboardConfig.google_calendar && (
                            <GoogleCalendarCard
                                isLinked={isCalendarLinked}
                                setupPending={!!pendingConnectionId}
                                onAction={handleCalendarAction}
                                onDismiss={!isCalendarLinked ? handleDismissGoogleCalendar : undefined}
                                loading={calendarLoading}
                            />
                        )}
                    </View>
                )}

                {/* Personal Workspaces Section (replaces Recent Workspaces; WorkspaceGrid kept but unused) */}
                <View
                    style={{
                        marginHorizontal: HORIZONTAL_PADDING,
                        gap: 16,
                    }}>
                    <View style={{ marginBottom: 8 }}>
                        <SectionHeader
                            title="PERSONAL WORKSPACES"
                            visible={dashboardConfig.recent_workspaces}
                            onToggleVisibility={() => toggleSection("recent_workspaces")}
                            right={
                                <TouchableOpacity onPress={onCreateWorkspace}>
                                    <PlusIcon size="18" weight="light" color={ThemedColor.caption} />
                                </TouchableOpacity>
                            }
                        />
                    </View>
                </View>
                <ScrollView
                    horizontal={false}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 108 }}>
                    {dashboardConfig.recent_workspaces && (
                        <View style={{ marginBottom: 18 }}>
                            {workspaces
                                .filter((workspace: any) => !workspace.isBlueprint)
                                .map((workspace: any) => {
                                    const taskCount = workspace.categories.reduce(
                                        (total: number, category: any) =>
                                            total + (category.tasks?.filter((task: any) => task.active !== false).length || 0),
                                        0
                                    );
                                    return (
                                        <WorkspaceDrawerItem
                                            key={workspace.name}
                                            title={workspace.name}
                                            selected=""
                                            taskCount={taskCount}
                                            workspaceIcon={workspace.icon ?? undefined}
                                            workspaceColor={workspace.color ?? undefined}
                                            onPress={() => onWorkspaceSelect(workspace.name)}
                                        />
                                    );
                                })}
                        </View>
                    )}
                {/* Recently Completed Tasks */}
                {dashboardConfig.recently_completed && <RecentlyCompletedTasks onToggleVisibility={() => toggleSection("recently_completed")} />}
                </ScrollView>
                </Animated.View>
            </MotiView>

            {pendingConnectionId && (
                <CalendarSetupBottomSheet
                    visible={showCalendarSetup}
                    setVisible={setShowCalendarSetup}
                    connectionId={pendingConnectionId}
                    onComplete={() => handleCalendarSetupComplete(pendingConnectionId)}
                    onCancel={() => {
                        setShowCalendarSetup(false);
                        setPendingConnectionId(null);
                    }}
                />
            )}
        </ScrollView>
    );
};

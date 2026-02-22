import React from "react";
import { ScrollView, View, Switch, TouchableOpacity, TextInput, RefreshControl } from "react-native";
import { MotiView } from "moti";
import { ThemedText } from "@/components/ThemedText";
import { WorkspaceGrid } from "./WorkspaceGrid";
import DashboardCards from "@/components/dashboard/DashboardCards";
import BottomDashboardCards from "@/components/dashboard/BottomDashboardCards";
import TutorialCard from "@/components/cards/TutorialCard";
import BasicCard from "@/components/cards/BasicCard";
import { useRouter } from "expo-router";
import { KudosCards } from "../cards/KudosCard";
import { HorseIcon, PlusIcon } from "phosphor-react-native";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import TodaySection from "./TodaySection";
import RecentlyCompletedTasks from "./RecentlyCompletedTasks";
import Ionicons from "@expo/vector-icons/Ionicons";
import { AttachStep } from "react-native-spotlight-tour";
import { GoogleCalendarCard } from "../cards/GoogleCalendarCard";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";
import { getCalendarConnections, connectGoogleCalendar, syncCalendarEvents, CalendarConnection } from "@/api/calendar";
import { useAlert } from "@/contexts/AlertContext";
import { formatErrorForAlert, ERROR_MESSAGES } from "@/utils/errorParser";
import CalendarSetupBottomSheet from "@/components/modals/CalendarSetupBottomSheet";

interface HomeScrollContentProps {
    encouragementCount: number;
    congratulationCount: number;
    workspaces: any[];
    displayWorkspaces: any[];
    fetchingWorkspaces: boolean;
    onWorkspaceSelect: (workspaceName: string) => void;
    onCreateWorkspace: () => void;
    shouldShowTutorial: boolean;
    drawerRef: any;
    ThemedColor: any;
    focusMode: boolean;
    toggleFocusMode: () => void;
    refreshing?: boolean;
    onRefresh?: () => void;
    scrollRef?: React.RefObject<ScrollView>;
    jumpBackInRef?: React.RefObject<View>;
    kudosRef?: React.RefObject<View>;
    onSpotlightLayout?: (key: "home_step_0" | "home_step_1", layout: { y: number; height: number }) => void;
}

export const HomeScrollContent: React.FC<HomeScrollContentProps> = ({
    encouragementCount,
    congratulationCount,
    workspaces,
    displayWorkspaces,
    fetchingWorkspaces,
    onWorkspaceSelect,
    onCreateWorkspace,
    shouldShowTutorial,
    drawerRef,
    ThemedColor,
    focusMode,
    toggleFocusMode,
    refreshing = false,
    onRefresh,
    scrollRef,
    jumpBackInRef,
    kudosRef,
    onSpotlightLayout,
}) => {
    const router = useRouter();
    const { showAlert } = useAlert();
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

    const handleJumpLayout = (event: any) => {
        if (!onSpotlightLayout) return;
        const { y, height } = event.nativeEvent.layout;
        onSpotlightLayout("home_step_0", { y, height });
    };

    const handleKudosLayout = (event: any) => {
        if (!onSpotlightLayout) return;
        const { y, height } = event.nativeEvent.layout;
        onSpotlightLayout("home_step_1", { y, height });
    };

    return (
        <ScrollView
            ref={scrollRef}
            style={{ gap: 8 }}
            contentContainerStyle={{ gap: 8 }}
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
            <MotiView style={{ gap: 8, marginTop: 12 }}>
                {/* Focus - always visible at the top */}
                {/* <BasicCard>
                    <View
                        style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                        }}>
                        <ThemedText type="default">Focus</ThemedText>
                        <Switch
                            value={focusMode}
                            onValueChange={toggleFocusMode}
                            trackColor={{
                                false: ThemedColor.caption + "40",
                                true: ThemedColor.primary,
                            }}
                            thumbColor={focusMode ? ThemedColor.tint : "#f4f3f4"}
                            ios_backgroundColor={ThemedColor.caption + "40"}
                        />
                    </View>
                </BasicCard> */}

                {/* Dashboard Cards */}
                <View style={{ marginLeft: HORIZONTAL_PADDING, gap: 12, marginBottom: 18 }}>
                    <AttachStep index={0}>
                        <View ref={jumpBackInRef} onLayout={handleJumpLayout}>
                            <ThemedText type="caption">JUMP BACK IN</ThemedText>
                        </View>
                    </AttachStep>
                    <DashboardCards drawerRef={drawerRef} />
                </View>

                {/* Kudos Cards (Encouragements & Congratulations) */}
                <View
                    style={{
                        marginHorizontal: HORIZONTAL_PADDING,
                        gap: 12,
                        marginBottom: 18,
                    }}>
                    <ThemedText type="caption">KUDOS</ThemedText>
                    <ThemedText type="caption">Send more Kudos to get premium features.</ThemedText>

                    <AttachStep index={1} style={{ width: "100%" }}>
                        <View ref={kudosRef} onLayout={handleKudosLayout}>
                            <KudosCards />
                        </View>
                    </AttachStep>
                </View>

                <View style={{ marginHorizontal: HORIZONTAL_PADDING, gap: 12, marginBottom: 12, }}>
                    <TouchableOpacity
                        style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
                        onPress={() => router.push("/(logged-in)/(tabs)/(task)/today")}
                    >
                        <ThemedText type="caption">UPCOMING</ThemedText>
                            <Ionicons name="chevron-forward" size={16} color={ThemedColor.caption} />
                        </TouchableOpacity>
                    <TodaySection />
                </View>


                {/* <View style={{ marginHorizontal: HORIZONTAL_PADDING, gap: 12, marginBottom: 12, }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <ThemedText type="caption">QUICK TASK</ThemedText>
                        <TouchableOpacity onPress={() => router.push("/(logged-in)/(tabs)/(task)/today")}>
                            <Ionicons name="add" size={16} color={ThemedColor.caption} />
                        </TouchableOpacity>
                    </View>
                    <TextInput placeholder="Whats on your mind?" style={{ backgroundColor: ThemedColor.lightened, borderRadius: 8, padding: 16, fontSize: 16, fontFamily: "OutfitLight" }} />
                </View> */}

                {/* Google Calendar Connection Card */}
                {showGoogleCalendarCard && (
                    <View style={{ marginHorizontal: HORIZONTAL_PADDING, marginBottom: 18 }}>
                        <GoogleCalendarCard
                            isLinked={isCalendarLinked}
                            setupPending={!!pendingConnectionId}
                            onAction={handleCalendarAction}
                            onDismiss={!isCalendarLinked ? handleDismissGoogleCalendar : undefined}
                            loading={calendarLoading}
                        />
                    </View>
                )}

                {/* Recent Workspaces Section */}
                <View
                    style={{
                        marginHorizontal: HORIZONTAL_PADDING,
                        gap: 16,
                    }}>
                    <View
                        style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            marginBottom: 2,
                        }}>
                        <ThemedText type="caption">RECENT WORKSPACES</ThemedText>
                        <TouchableOpacity onPress={onCreateWorkspace}>
                            <PlusIcon size="18" weight="light" color={ThemedColor.caption}></PlusIcon>
                        </TouchableOpacity>
                    </View>
                </View>
                <ScrollView
                    horizontal={false}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 108 }}>
                    <View
                        style={{
                            marginHorizontal: HORIZONTAL_PADDING,
                            gap: 16,
                            marginBottom: 18,
                        }}>
                        {/* Workspace Grid */}
                        <WorkspaceGrid
                            workspaces={workspaces}
                            displayWorkspaces={displayWorkspaces}
                            fetchingWorkspaces={fetchingWorkspaces}
                            onWorkspacePress={onWorkspaceSelect}
                            ThemedColor={ThemedColor}
                        />
                    </View>
                {/* Recently Completed Tasks */}
                <RecentlyCompletedTasks />

                    {/* Tutorial Card */}
                    <View
                        style={{
                            marginLeft: HORIZONTAL_PADDING,
                            marginRight: HORIZONTAL_PADDING,
                        }}>
                        <TutorialCard
                            onPress={() => router.push("/(logged-in)/(tutorial)")}
                            showBadge={shouldShowTutorial}
                        />
                    </View>
                </ScrollView>
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

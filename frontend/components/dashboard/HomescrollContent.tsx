import React, { useState, useCallback, useRef, useEffect } from "react";
import { ScrollView, View, TouchableOpacity, RefreshControl, InteractionManager, Platform, StyleSheet } from "react-native";
import Reanimated, {
    Easing,
    SharedValue,
    interpolate,
    runOnJS,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import * as WebBrowser from "expo-web-browser";
import { CalendarPlus, CaretDown, PlusIcon } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import { WorkspaceDrawerItem } from "@/components/home/WorkspaceDrawerItem";
import WorkspaceTaskPreview from "@/components/dashboard/WorkspaceTaskPreview";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { pendingWorkspaceTaskCount } from "@/utils/workspaceCounts";
import { SectionTitle } from "./SectionHeader";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { useIsGuest } from "@/hooks/useIsGuest";
import { getCalendarConnections, connectGoogleCalendar, syncCalendarEvents } from "@/api/calendar";
import { useAlert } from "@/contexts/AlertContext";
import { formatErrorForAlert, ERROR_MESSAGES } from "@/utils/errorParser";
import CalendarSetupBottomSheet from "@/components/modals/CalendarSetupBottomSheet";
import ProductivityRingsCard, { RingRewardClaim } from "@/components/profile/ProductivityRings";
import { HOME_DOCK_SPACE } from "@/components/dashboard/HomeQuickAddDock";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import RingsBlurOverlay from "@/components/profile/RingsBlurOverlay";
import HomeFocusStack from "@/components/dashboard/HomeFocusStack";
import { useHomeStageQueue } from "@/hooks/useHomeStageQueue";
import type { HomeTour } from "@/hooks/useHomeTour";
import { hapticLight } from "@/utils/haptics";
import { GuestLoginLink } from "@/components/dashboard/GuestLoginLink";

interface HomeScrollContentProps {
    userName?: string;
    workspaces: any[];
    onWorkspaceSelect: (workspaceName: string) => void;
    onCreateWorkspace: () => void;
    ThemedColor: any;
    refreshing?: boolean;
    onRefresh?: () => void;
    scrollRef?: React.RefObject<ScrollView>;
    tour: HomeTour;
    /** tab glow pull progress (0-1); when set, iOS pull-to-refresh drives the glow instead of the spinner */
    glowPull?: SharedValue<number>;
    /** bumped on release to replay the glow's opening */
    glowReplay?: SharedValue<number>;
}

// overscroll (px) that arms a refresh; the glow tracks progress toward it
const PULL_DISTANCE = 96;
// Gap above the focus stack once "View all" lifts it to the top
const LIFTED_TOP = 8;

const greetingFor = (h: number) => (h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");

type CalendarState = { linked: boolean | null; pendingId: string | null };

const readCalendarState = async (): Promise<CalendarState> => {
    const { connections } = await getCalendarConnections();
    const completed = connections?.find((c) => c.setup_complete);
    const pending = connections?.find((c) => !c.setup_complete);
    return { linked: !!completed, pendingId: completed ? null : pending?.id ?? null };
};

// Calm focus home: rings, greeting, one task, quick add; workspaces below the fold.
export const HomeScrollContent = React.memo<HomeScrollContentProps>(function HomeScrollContent({
    userName,
    workspaces,
    onWorkspaceSelect,
    onCreateWorkspace,
    ThemedColor,
    refreshing = false,
    onRefresh,
    scrollRef,
    tour,
    glowPull,
    glowReplay,
}) {
    const { showAlert } = useAlert();
    const isGuest = useIsGuest();
    const queue = useHomeStageQueue();
    const [ringsExpanded, setRingsExpanded] = useState(false);
    const [viewportHeight, setViewportHeight] = useState(0);

    // "View all": the stack lifts to the top and spills into a list while everything else fades
    const spill = useSharedValue(0);
    const [stackListed, setStackListed] = useState(false);
    const [focusY, setFocusY] = useState(0);
    const onStackListedChange = useCallback(
        (listed: boolean) => {
            setStackListed(listed);
            if (listed) (scrollRef?.current as any)?.scrollTo({ y: 0, animated: true });
        },
        [scrollRef]
    );
    const fadeStyle = useAnimatedStyle(() => ({ opacity: interpolate(spill.value, [0, 0.5], [1, 0], "clamp") }));
    const liftStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -spill.value * Math.max(focusY - LIFTED_TOP, 0) }] }));
    const faded = stackListed ? "none" : "auto";

    // Per-workspace task preview: collapsed by default, persisted locally
    const [expandedPreviews, setExpandedPreviews] = useState<Record<string, boolean>>({});
    const loadedPreviewNamesRef = useRef<Set<string>>(new Set());
    useEffect(() => {
        const names = workspaces.map((w: any) => w.name).filter((name: string) => !loadedPreviewNamesRef.current.has(name));
        if (names.length === 0) return;
        names.forEach((name: string) => loadedPreviewNamesRef.current.add(name));
        AsyncStorage.multiGet(names.map((name: string) => `workspace-preview-expanded-${name}`))
            .then((pairs) => {
                const entries = pairs.map(([, v], i) => [names[i], v === "true"] as const);
                setExpandedPreviews((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
            })
            .catch(() => {});
    }, [workspaces]);
    const toggleWorkspacePreview = useCallback((name: string) => {
        setExpandedPreviews((prev) => {
            const next = !prev[name];
            AsyncStorage.setItem(`workspace-preview-expanded-${name}`, next ? "true" : "false");
            return { ...prev, [name]: next };
        });
    }, []);

    const [calendar, setCalendar] = useState<CalendarState>({ linked: null, pendingId: null });
    const [showCalendarSetup, setShowCalendarSetup] = useState(false);
    const [calendarLoading, setCalendarLoading] = useState(false);

    useEffect(() => {
        if (isGuest) return;
        // Not needed for first paint — let the pager/launch animations settle first
        const task = InteractionManager.runAfterInteractions(() => {
            readCalendarState()
                .then(setCalendar)
                .catch((error) => console.error("Error checking calendar status:", error));
        });
        return () => task.cancel();
    }, [isGuest]);

    const handleConnectCalendar = async () => {
        if (calendar.pendingId) return setShowCalendarSetup(true);
        setCalendarLoading(true);
        try {
            const { auth_url } = await connectGoogleCalendar();
            // 'kindred://' lets iOS hand the redirect URL back (kindred://calendar/linked?connectionId=xxx)
            const result = await WebBrowser.openAuthSessionAsync(auth_url, "kindred://");
            const connId = result.type === "success" ? result.url?.match(/connectionId=([^&]+)/)?.[1] : undefined;
            const next = connId ? { linked: false, pendingId: connId } : await readCalendarState();
            setCalendar(next);
            if (next.pendingId) setShowCalendarSetup(true);
        } catch (error) {
            console.error("Error connecting Google Calendar:", error);
            const errorInfo = formatErrorForAlert(error, ERROR_MESSAGES.CALENDAR_CONNECT_FAILED);
            showAlert({ title: errorInfo.title, message: errorInfo.message, buttons: [{ text: "OK", style: "default" }] });
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
            onRefresh?.();
        } catch (error) {
            console.error("Error syncing calendar after setup:", error);
            const errorInfo = formatErrorForAlert(error, ERROR_MESSAGES.CALENDAR_SYNC_FAILED);
            showAlert({
                title: "Calendar Linked",
                message: `Your calendar was linked, but we couldn't sync events automatically.\n\n${errorInfo.message}`,
                buttons: [{ text: "OK", style: "default" }],
            });
        }
        readCalendarState().then(setCalendar).catch(() => setCalendar({ linked: true, pendingId: null }));
    };

    // iOS overscroll lifts the tab glow; release past the threshold refreshes and replays its opening.
    // Android can't overscroll past 0, and reduced motion has no animation to show, so both keep the spinner.
    const reduceMotion = useReducedMotion();
    const glowRefresh = Platform.OS === "ios" && !reduceMotion && !!onRefresh && !!glowPull && !!glowReplay;
    const refreshingRef = useRef(refreshing);
    refreshingRef.current = refreshing;
    const refreshFromPull = useCallback(() => {
        if (!refreshingRef.current) onRefresh?.();
    }, [onRefresh]);
    const onScrollY = tour.onScrollY;
    const dragging = useSharedValue(false);
    const armed = useSharedValue(false);
    const scrollHandler = useAnimatedScrollHandler(
        {
            onBeginDrag: () => {
                dragging.value = true;
                armed.value = false;
            },
            onScroll: (e) => {
                runOnJS(onScrollY)(e.contentOffset.y);
                if (!glowRefresh || !glowPull || !dragging.value) return;
                const progress = Math.min(Math.max(-e.contentOffset.y / PULL_DISTANCE, 0), 1);
                glowPull.value = progress;
                if (progress >= 1 && !armed.value) {
                    armed.value = true;
                    runOnJS(hapticLight)();
                } else if (progress < 1) {
                    armed.value = false;
                }
            },
            onEndDrag: () => {
                dragging.value = false;
                if (!glowRefresh || !glowPull || !glowReplay) return;
                if (armed.value) {
                    armed.value = false;
                    glowReplay.value += 1;
                    runOnJS(refreshFromPull)();
                } else {
                    glowPull.value = withTiming(0, { duration: 300, easing: Easing.bezier(0.2, 0, 0, 1) });
                }
            },
        },
        [glowRefresh, onScrollY, refreshFromPull]
    );

    // Two snap points: the focus stage, then the workspaces list; both clear the docked quick add.
    const insets = useSafeAreaInsets();
    const dockClearance = insets.bottom + HOME_DOCK_SPACE;
    const showWorkspaces = tour.visibleUpTo("workspaces");
    const snapOffsets = viewportHeight && showWorkspaces ? [0, viewportHeight] : undefined;
    const toWorkspaces = () => (scrollRef?.current as any)?.scrollTo({ y: viewportHeight, animated: true });

    const realWorkspaces = workspaces.filter((w: any) => !w.isBlueprint);
    const showCalendarChip = !isGuest && calendar.linked === false && !tour.active;

    return (
        <Reanimated.ScrollView
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
            onScroll={scrollHandler}
            scrollEnabled={!stackListed}
            scrollEventThrottle={16}
            onLayout={(e) => setViewportHeight(e.nativeEvent.layout.height)}
            snapToOffsets={snapOffsets}
            snapToEnd={false}
            decelerationRate="fast"
            refreshControl={
                onRefresh && !glowRefresh ? (
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ThemedColor.primary} colors={[ThemedColor.primary]} />
                ) : undefined
            }>
            {/* Sibling of the rings container so the rings' zIndex:999 can float above the blur's 998 */}
            <RingsBlurOverlay visible={ringsExpanded} onDismiss={() => setRingsExpanded(false)} />

            <View style={[styles.stage, { height: viewportHeight || undefined, paddingBottom: dockClearance }]}>
                <View style={styles.center}>
                    {/* Private to the user; live-updates via the useRings cache */}
                    <Reanimated.View
                        ref={(node) => tour.registerSection("rings", node)}
                        pointerEvents={faded}
                        style={[{ width: "100%", zIndex: ringsExpanded ? 999 : 0 }, fadeStyle]}>
                        <ProductivityRingsCard variant="rings" compact hideClaim expanded={ringsExpanded} onExpandChange={setRingsExpanded} />
                    </Reanimated.View>

                    <Reanimated.View pointerEvents={faded} style={[styles.greetingBlock, fadeStyle]}>
                        <ThemedText type="titleFraunces" style={styles.greeting}>
                            {greetingFor(new Date().getHours())}, {userName || "there"}
                        </ThemedText>
                        {isGuest && <GuestLoginLink />}
                    </Reanimated.View>

                    {tour.visibleUpTo("focus") && (
                        <Reanimated.View
                            ref={(node) => tour.registerSection("focus", node)}
                            collapsable={false}
                            onLayout={(e) => setFocusY(e.nativeEvent.layout.y)}
                            style={[{ width: "100%", zIndex: 1 }, liftStyle]}>
                            <HomeFocusStack
                                queue={queue}
                                onWorkspacePress={onWorkspaceSelect}
                                spill={spill}
                                onListedChange={onStackListedChange}
                                availableHeight={viewportHeight - dockClearance - LIFTED_TOP}
                            />
                        </Reanimated.View>
                    )}

                    {!stackListed && (
                        <View style={{ width: "100%" }}>
                            <RingRewardClaim />
                        </View>
                    )}

                    {showCalendarChip && !stackListed && (
                        <TouchableOpacity
                            onPress={handleConnectCalendar}
                            disabled={calendarLoading}
                            activeOpacity={0.7}
                            style={[styles.chip, { backgroundColor: ThemedColor.primary + "14", opacity: calendarLoading ? 0.6 : 1 }]}>
                            <CalendarPlus size={16} color={ThemedColor.primary} />
                            <ThemedText type="smallerDefault" style={{ color: ThemedColor.primary }}>
                                {calendar.pendingId ? "Finish calendar setup" : "Connect calendar"}
                            </ThemedText>
                        </TouchableOpacity>
                    )}
                </View>

                {!tour.active && showWorkspaces && !stackListed && (
                    <TouchableOpacity onPress={toWorkspaces} hitSlop={10} activeOpacity={0.6} style={styles.more} accessibilityLabel="Show workspaces">
                        <ThemedText type="caption">Workspaces</ThemedText>
                        <CaretDown size={12} color={ThemedColor.caption} />
                    </TouchableOpacity>
                )}
            </View>

            {showWorkspaces && (
                <View
                    ref={(node) => tour.registerSection("workspaces", node)}
                    style={{ paddingTop: 12, minHeight: viewportHeight || undefined, paddingBottom: dockClearance }}>
                    <View style={styles.sectionHeader}>
                        <SectionTitle title="Workspaces" />
                        <TouchableOpacity onPress={onCreateWorkspace} hitSlop={10} accessibilityLabel="Create workspace">
                            <PlusIcon size={18} weight="light" color={ThemedColor.caption} />
                        </TouchableOpacity>
                    </View>
                    {realWorkspaces.map((workspace: any) => (
                        <View key={workspace.name}>
                            {/* Accent rail spans the row and its task preview */}
                            <View
                                style={[styles.rail, { backgroundColor: (workspace.color ?? ThemedColor.tertiary) + "66" }]}
                            />
                            <WorkspaceDrawerItem
                                title={workspace.name}
                                selected=""
                                taskCount={pendingWorkspaceTaskCount(workspace.categories)}
                                workspaceIcon={workspace.icon ?? undefined}
                                workspaceColor={workspace.color ?? undefined}
                                onPress={() => onWorkspaceSelect(workspace.name)}
                                previewExpanded={!!expandedPreviews[workspace.name]}
                                onTogglePreview={() => toggleWorkspacePreview(workspace.name)}
                            />
                            {expandedPreviews[workspace.name] && (
                                <WorkspaceTaskPreview
                                    categories={workspace.categories}
                                    onShowAll={() => onWorkspaceSelect(workspace.name)}
                                    ThemedColor={ThemedColor}
                                />
                            )}
                        </View>
                    ))}
                </View>
            )}

            {calendar.pendingId && (
                <CalendarSetupBottomSheet
                    visible={showCalendarSetup}
                    setVisible={setShowCalendarSetup}
                    connectionId={calendar.pendingId}
                    onComplete={() => handleCalendarSetupComplete(calendar.pendingId!)}
                    onCancel={() => {
                        setShowCalendarSetup(false);
                        setCalendar((c) => ({ ...c, pendingId: null }));
                    }}
                />
            )}
        </Reanimated.ScrollView>
    );
});

const styles = StyleSheet.create({
    stage: {
        paddingHorizontal: HORIZONTAL_PADDING,
        justifyContent: "space-between",
        gap: 12,
    },
    center: {
        flex: 1,
        alignItems: "center",
        gap: 20,
        paddingTop: 32,
    },
    more: {
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "center",
        gap: 4,
        paddingVertical: 4,
    },
    greeting: {
        textAlign: "center",
    },
    greetingBlock: {
        alignItems: "center",
        gap: 6,
    },
    chip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 100,
    },
    rail: { position: "absolute", left: 20, top: 0, bottom: 0, width: 3, borderRadius: 3 },
    sectionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: HORIZONTAL_PADDING,
        marginBottom: 8,
    },
});

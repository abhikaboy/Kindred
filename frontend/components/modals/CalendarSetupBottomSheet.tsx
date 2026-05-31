import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, TouchableOpacity, Switch, ActivityIndicator, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "@/components/ThemedText";
import DefaultModal from "./DefaultModal";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Ionicons } from "@expo/vector-icons";
import { getConnectionCalendars, setupCalendarWorkspaces, disconnectCalendar, CalendarInfo } from "@/api/calendar";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";

interface Props {
    visible: boolean;
    setVisible: (v: boolean) => void;
    connectionId: string;
    onComplete: () => void;
    onCancel: () => void;
}

export default function CalendarSetupBottomSheet({
    visible,
    setVisible,
    connectionId,
    onComplete,
    onCancel,
}: Props) {
    const ThemedColor = useThemeColor();
    const insets = useSafeAreaInsets();
    const { height: windowHeight } = useWindowDimensions();
    const [calendars, setCalendars] = useState<CalendarInfo[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [pushEnabled, setPushEnabled] = useState(false);
    const [mergeIntoOne, setMergeIntoOne] = useState(false);
    const [makePublic, setMakePublic] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [creating, setCreating] = useState(false);

    // Tracks whether the user successfully completed setup in this open. When
    // false on dismiss, we treat the dismiss as a cancel and disconnect the
    // pending connection; when true, the dismiss is the success path and we
    // leave the connection alone. Without this, DefaultModal's onChange(-1)
    // callback would route every modal close through handleCancel —
    // including the close-on-success path — silently disconnecting the
    // calendar the user just finished setting up.
    const completedRef = useRef(false);

    useEffect(() => {
        if (visible) {
            completedRef.current = false;
        }
    }, [visible]);

    useEffect(() => {
        if (visible && connectionId) {
            const fetchCalendars = async () => {
                setFetching(true);
                try {
                    const { calendars: cal } = await getConnectionCalendars(connectionId);
                    setCalendars(cal);
                    setSelectedIds(cal.map((c: any) => c.id || c.ID)); // pre-select all
                } catch (err) {
                    console.error("Failed to fetch calendars:", err);
                } finally {
                    setFetching(false);
                }
            };
            fetchCalendars();
        }
    }, [visible, connectionId]);

    const toggleCalendar = (id: string) => {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    };

    const handleCreate = async () => {
        if (selectedIds.length === 0 || creating) return;
        setCreating(true);
        try {
            const pushEnabledCalendarIds = pushEnabled ? selectedIds : [];
            await setupCalendarWorkspaces(
                connectionId,
                selectedIds,
                pushEnabledCalendarIds,
                mergeIntoOne,
                makePublic,
            );
            // Mark completion BEFORE onComplete triggers the parent to close
            // the modal — otherwise handleDismiss would race and treat the
            // success-path close as a cancel.
            completedRef.current = true;
            onComplete();
        } catch (err) {
            console.error("Failed to set up workspaces:", err);
        } finally {
            setCreating(false);
        }
    };

    // Routes both explicit cancels (Cancel button) and implicit dismisses
    // (backdrop tap, swipe-down, parent flipping `visible`). Only the no-
    // completion case is treated as a user-cancel that drops the connection.
    const handleDismiss = async (open: boolean) => {
        setVisible(open);
        if (open || completedRef.current) return;
        try {
            await disconnectCalendar(connectionId);
        } catch (err) {
            console.error("Failed to remove pending calendar connection:", err);
        }
        onCancel();
    };

    const handleCancelPress = () => {
        setVisible(false);
    };

    const renderCalendarItem = ({ item }: { item: CalendarInfo }) => {
        const itemId = item.id || (item as any).ID;
        const isSelected = selectedIds.includes(itemId);
        return (
            <TouchableOpacity
                style={[
                    styles.calendarItem,
                    { backgroundColor: ThemedColor.lightenedCard, borderColor: ThemedColor.tertiary, height: "auto"},
                ]}
                onPress={() => toggleCalendar(itemId)}
                activeOpacity={0.7}>
                <View style={styles.calendarContent}>
                    <View style={styles.calendarInfo}>
                        <ThemedText type="default">{item.name}</ThemedText>
                        {item.is_primary && (
                            <ThemedText type="caption" style={{ color: ThemedColor.primary }}>
                                Primary
                            </ThemedText>
                        )}
                    </View>
                    <View
                        style={[
                            styles.checkbox,
                            {
                                backgroundColor: isSelected ? ThemedColor.primary : "transparent",
                                borderColor: isSelected ? "transparent" : ThemedColor.text,
                                borderWidth: isSelected ? 0 : 1.5,
                            },
                        ]}>
                        {isSelected && <Ionicons name="checkmark" size={18} color="#FFFFFF" />}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const splitIntoWorkspaces = !mergeIntoOne;
    const buttonTitle = splitIntoWorkspaces ? "Create Workspaces" : "Create Workspace";

    return (
        <DefaultModal
            visible={visible}
            setVisible={handleDismiss}
            snapPoints={["90%"]}
            enableContentPanningGesture={false}
        >
            <View style={styles.container}>
                <ThemedText type="subtitle" style={styles.title}>
                    Set Up Calendar
                </ThemedText>
                <ThemedText type="caption" style={[styles.subtitle, { color: ThemedColor.caption }]}>
                    Choose which calendars to import
                </ThemedText>

                {fetching ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={ThemedColor.primary} />
                    </View>
                ) : (
                    <View style={{ flex: 1 }}>
                        <BottomSheetScrollView
                            style={[styles.scroll, { maxHeight: windowHeight * 0.36 }]}
                            contentContainerStyle={styles.list}
                            showsVerticalScrollIndicator={true}
                            keyboardShouldPersistTaps="handled"
                        >
                            {calendars.map((item) => (
                                <View key={item.id || (item as any).ID}>
                                    {renderCalendarItem({ item } as any)}
                                </View>
                            ))}
                        </BottomSheetScrollView>

                        <View
                            style={[
                                styles.stickyFooter,
                                {
                                    backgroundColor: ThemedColor.background,
                                    borderTopColor: ThemedColor.tertiary,
                                    paddingBottom: insets.bottom || 16,
                                },
                            ]}>
                            <View style={styles.toggleRow}>
                                <View style={styles.toggleLabel}>
                                    <ThemedText type="default">Split into workspaces</ThemedText>
                                    <ThemedText type="caption" style={{ color: ThemedColor.caption }}>
                                        {splitIntoWorkspaces
                                            ? "Each calendar gets its own workspace"
                                            : "All calendars share one workspace"}
                                    </ThemedText>
                                </View>
                                <Switch
                                    value={splitIntoWorkspaces}
                                    onValueChange={(value) => setMergeIntoOne(!value)}
                                    trackColor={{ false: ThemedColor.tertiary, true: ThemedColor.primary }}
                                    thumbColor="#ffffff"
                                    ios_backgroundColor={ThemedColor.tertiary}
                                />
                            </View>
                            <View style={styles.toggleRow}>
                                <View style={styles.toggleLabel}>
                                    <ThemedText type="default">Public events</ThemedText>
                                    <ThemedText type="caption" style={{ color: ThemedColor.caption }}>
                                        {makePublic
                                            ? "Imported events visible to friends"
                                            : "Imported events kept private"}
                                    </ThemedText>
                                </View>
                                <Switch
                                    value={makePublic}
                                    onValueChange={setMakePublic}
                                    trackColor={{ false: ThemedColor.tertiary, true: ThemedColor.primary }}
                                    thumbColor="#ffffff"
                                    ios_backgroundColor={ThemedColor.tertiary}
                                />
                            </View>
                            <View style={styles.toggleRow}>
                                <View style={styles.toggleLabel}>
                                    <ThemedText type="default">Push tasks to calendar</ThemedText>
                                    <ThemedText type="caption" style={{ color: ThemedColor.caption }}>
                                        {pushEnabled
                                            ? "Two-way sync — tasks you create or edit in Kindred write back to Google Calendar"
                                            : "One-way import only — Kindred won't change your calendar"}
                                    </ThemedText>
                                </View>
                                <Switch
                                    value={pushEnabled}
                                    onValueChange={setPushEnabled}
                                    trackColor={{ false: ThemedColor.tertiary, true: ThemedColor.primary }}
                                    thumbColor="#ffffff"
                                    ios_backgroundColor={ThemedColor.tertiary}
                                />
                            </View>

                            <View style={styles.buttonContainer}>
                                <PrimaryButton
                                    title="Cancel"
                                    onPress={handleCancelPress}
                                    secondary
                                    style={styles.button}
                                />
                                <PrimaryButton
                                    title={buttonTitle}
                                    onPress={handleCreate}
                                    disabled={selectedIds.length === 0 || creating}
                                    style={styles.button}
                                />
                            </View>
                        </View>
                    </View>
                )}
            </View>
        </DefaultModal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: 8,
        paddingBottom: 0,
    },
    title: {
        marginBottom: 8,
    },
    subtitle: {
        marginBottom: 16,
    },
    loadingContainer: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 40,
    },
    list: {
        gap: 12,
        flexGrow: 1,
    },
    scroll: {},
    calendarItem: {
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
    },
    calendarContent: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    calendarInfo: {
        gap: 2,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        alignItems: "center",
        justifyContent: "center",
        marginLeft: 12,
    },
    toggleRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 12,
    },
    toggleLabel: {
        flex: 1,
        gap: 2,
        marginRight: 16,
    },
    buttonContainer: {
        flexDirection: "column",
        gap: 12,
        paddingTop: 8,
    },
    button: {
        alignSelf: "stretch",
    },
    stickyFooter: {
        borderTopWidth: StyleSheet.hairlineWidth,
        paddingTop: 16,
    },
    stickyFooterBase: {
    },
});

import React, { useState, useEffect } from "react";
import { View, StyleSheet, TouchableOpacity, FlatList, Switch, ActivityIndicator } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import DefaultModal from "./DefaultModal";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Ionicons } from "@expo/vector-icons";
import { getConnectionCalendars, setupCalendarWorkspaces, CalendarInfo } from "@/api/calendar";

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
    const [calendars, setCalendars] = useState<CalendarInfo[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [mergeIntoOne, setMergeIntoOne] = useState(true);
    const [fetching, setFetching] = useState(false);
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        if (visible && connectionId) {
            const fetchCalendars = async () => {
                setFetching(true);
                try {
                    const { calendars: cal } = await getConnectionCalendars(connectionId);
                    setCalendars(cal);
                    setSelectedIds(cal.map((c) => c.id)); // pre-select all
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
            await setupCalendarWorkspaces(connectionId, selectedIds, mergeIntoOne);
            onComplete();
        } catch (err) {
            console.error("Failed to set up workspaces:", err);
        } finally {
            setCreating(false);
        }
    };

    const handleCancel = () => {
        setVisible(false);
        onCancel();
    };

    const renderCalendarItem = ({ item }: { item: CalendarInfo }) => {
        const isSelected = selectedIds.includes(item.id);
        return (
            <TouchableOpacity
                style={[
                    styles.calendarItem,
                    { backgroundColor: ThemedColor.lightenedCard, borderColor: ThemedColor.tertiary },
                ]}
                onPress={() => toggleCalendar(item.id)}
                activeOpacity={0.7}>
                <View style={styles.calendarContent}>
                    <View style={styles.calendarInfo}>
                        <ThemedText type="default">{item.name}</ThemedText>
                        {item.is_primary && (
                            <ThemedText type="caption" style={{ color: ThemedColor.caption }}>
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

    const buttonTitle = mergeIntoOne ? "Create Workspace" : "Create Workspaces";

    return (
        <DefaultModal visible={visible} setVisible={handleCancel} snapPoints={["80%"]}>
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
                    <>
                        <FlatList
                            data={calendars}
                            renderItem={renderCalendarItem}
                            keyExtractor={(item) => item.id}
                            contentContainerStyle={styles.list}
                            showsVerticalScrollIndicator={false}
                        />

                        <View style={[styles.toggleRow, { borderTopColor: ThemedColor.tertiary }]}>
                            <View style={styles.toggleLabel}>
                                <ThemedText type="default">One workspace for all</ThemedText>
                                <ThemedText type="caption" style={{ color: ThemedColor.caption }}>
                                    {mergeIntoOne
                                        ? "All calendars share one workspace"
                                        : "Each calendar gets its own workspace"}
                                </ThemedText>
                            </View>
                            <Switch
                                value={mergeIntoOne}
                                onValueChange={setMergeIntoOne}
                                trackColor={{ false: ThemedColor.tertiary, true: ThemedColor.primary }}
                                thumbColor="#ffffff"
                                ios_backgroundColor={ThemedColor.tertiary}
                            />
                        </View>

                        <View style={styles.buttonContainer}>
                            <PrimaryButton
                                title="Cancel"
                                onPress={handleCancel}
                                outline
                                style={styles.button}
                            />
                            <PrimaryButton
                                title={buttonTitle}
                                onPress={handleCreate}
                                disabled={selectedIds.length === 0 || creating}
                                style={styles.button}
                            />
                        </View>
                    </>
                )}
            </View>
        </DefaultModal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: 8,
    },
    title: {
        marginBottom: 8,
    },
    subtitle: {
        marginBottom: 16,
    },
    loadingContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 40,
    },
    list: {
        gap: 12,
        paddingBottom: 16,
    },
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
        flex: 1,
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
        paddingVertical: 16,
        borderTopWidth: StyleSheet.hairlineWidth,
        marginBottom: 4,
    },
    toggleLabel: {
        flex: 1,
        gap: 2,
        marginRight: 16,
    },
    buttonContainer: {
        flexDirection: "row",
        gap: 12,
        paddingTop: 12,
    },
    button: {
        flex: 1,
    },
});

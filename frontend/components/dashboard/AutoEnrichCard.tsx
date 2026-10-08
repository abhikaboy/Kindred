import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BottomSheetFooter, BottomSheetScrollView, type BottomSheetFooterProps } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MotiView } from "moti";
import { CalendarDotsIcon, ClockIcon, FlagIcon, MagicWandIcon, PlanetIcon, TextAaIcon, XIcon } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import DefaultModal from "@/components/modals/DefaultModal";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useAuth } from "@/hooks/useAuth";
import { useTaskActions } from "@/contexts/tasksContext";
import { useSomedayTasks } from "@/hooks/useSomedayTasks";
import { applyEnrichAPI, getEnrichStatusAPI, previewEnrichAPI, type EnrichChange, type EnrichPreview, type EnrichStatus } from "@/api/task";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { hapticLight } from "@/utils/haptics";
import { showToast } from "@/utils/showToast";
import type { Task } from "@/api/types";

// Offered at most once per cycle: it appears on the first day the backlog is
// big enough, stays for that day, then rests for a week whether or not it was used.
const CYCLE_MS = 7 * 24 * 60 * 60 * 1000;
const offerKey = (userId: string) => `${userId}-auto-enrich-offer`;
type OfferState = { start: number; handled: boolean };

const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();

function useEnrichOffer(userId?: string) {
    const [status, setStatus] = useState<EnrichStatus | null>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!userId) return;
        let cancelled = false;
        (async () => {
            const raw = await AsyncStorage.getItem(offerKey(userId)).catch(() => null);
            const offer: OfferState | null = raw ? JSON.parse(raw) : null;
            const now = Date.now();
            const inCycle = offer && now - offer.start < CYCLE_MS;
            // Mid-cycle it only lingers for the rest of the day it first showed
            if (inCycle && (offer.handled || !sameDay(offer.start, now))) return;

            const next = await getEnrichStatusAPI();
            if (cancelled || !next?.eligible) return;
            if (!inCycle) {
                AsyncStorage.setItem(offerKey(userId), JSON.stringify({ start: now, handled: false })).catch(() => {});
            }
            setStatus(next);
            setVisible(true);
        })();
        return () => {
            cancelled = true;
        };
    }, [userId]);

    const markHandled = useCallback(() => {
        setVisible(false);
        if (!userId) return;
        AsyncStorage.setItem(offerKey(userId), JSON.stringify({ start: Date.now(), handled: true })).catch(() => {});
    }, [userId]);

    return { status, visible, markHandled };
}

/** Occasional home chip that offers to schedule and fill in neglected tasks. */
export default function AutoEnrichCard() {
    const ThemedColor = useThemeColor();
    const { user } = useAuth();
    const { status, visible, markHandled } = useEnrichOffer(user?._id);
    const [sheetVisible, setSheetVisible] = useState(false);

    if (!status) return null;
    const count = status.candidateCount;

    return (
        <>
            {visible && (
                <View style={[styles.chip, { backgroundColor: ThemedColor.primary + "26" }]}>
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => {
                            hapticLight();
                            setSheetVisible(true);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Tidy up ${count} task${count === 1 ? "" : "s"} with no day planned`}
                        style={styles.chipBody}>
                        <MagicWandIcon size={16} color={ThemedColor.primary} />
                        <ThemedText type="smallerDefault" style={{ color: ThemedColor.primary }}>
                            Tidy up {count} task{count === 1 ? "" : "s"}
                        </ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={markHandled} hitSlop={12} accessibilityLabel="Not now">
                        <XIcon size={12} color={ThemedColor.primary} />
                    </TouchableOpacity>
                </View>
            )}
            <AutoEnrichSheet visible={sheetVisible} setVisible={setSheetVisible} status={status} onApplied={markHandled} />
        </>
    );
}

type Stage = "intro" | "loading" | "review" | "error";

interface SheetProps {
    visible: boolean;
    setVisible: (visible: boolean) => void;
    status: EnrichStatus;
    onApplied: () => void;
}

// Clearing a summary entry clears the update fields behind it, so the change
// that gets applied always matches what the user sees.
const FIELD_KEYS: Record<string, (keyof EnrichChange["updates"])[]> = {
    content: ["content"],
    start: ["startDate", "startTime"],
    deadline: ["deadline"],
    priority: ["priority"],
    value: ["value"],
};

function dropPart(change: EnrichChange, index: number): EnrichChange | null {
    const field = change.fields?.[index];
    const updates = { ...change.updates };
    (FIELD_KEYS[field ?? ""] ?? []).forEach((key) => delete updates[key]);
    const summary = change.summary.filter((_, i) => i !== index);
    if (summary.length === 0) return null;
    return { ...change, updates, summary, fields: change.fields?.filter((_, i) => i !== index) };
}

function AutoEnrichSheet({ visible, setVisible, status, onApplied }: SheetProps) {
    const ThemedColor = useThemeColor();
    const insets = useSafeAreaInsets();
    const { updateTask, setSelected } = useTaskActions();
    const { groups: somedayGroups } = useSomedayTasks();
    const somedayCount = useMemo(() => somedayGroups.reduce((n, g) => n + g.tasks.length, 0), [somedayGroups]);
    const [stage, setStage] = useState<Stage>("intro");
    const [preview, setPreview] = useState<EnrichPreview | null>(null);
    // Working copy the user trims down; the preview stays intact for "bring back"
    const [changes, setChanges] = useState<EnrichChange[]>([]);
    const [applying, setApplying] = useState(false);

    const lookOver = useCallback(async () => {
        setStage("loading");
        try {
            const next = await previewEnrichAPI();
            setPreview(next);
            setChanges(next.changes);
            setStage("review");
        } catch {
            setStage("error");
        }
    }, []);

    const dismissTask = (taskId: string) => {
        hapticLight();
        setChanges((prev) => prev.filter((c) => c.taskId !== taskId));
    };

    const dismissPart = (taskId: string, index: number) => {
        hapticLight();
        setChanges((prev) =>
            prev.flatMap((c) => {
                if (c.taskId !== taskId) return [c];
                const next = dropPart(c, index);
                return next ? [next] : [];
            })
        );
    };

    const dismissedCount = (preview?.changes.length ?? 0) - changes.length;
    const editedCount = changes.filter((c) => preview?.changes.find((p) => p.taskId === c.taskId)?.summary.length !== c.summary.length).length;

    const apply = useCallback(async () => {
        if (changes.length === 0) return;
        setApplying(true);
        try {
            const tasks = await applyEnrichAPI(changes);
            tasks.forEach((t) => {
                const task = t as unknown as Task;
                if (task.categoryID) updateTask(task.categoryID, task.id, task);
            });
            showToast(`Updated ${tasks.length} task${tasks.length === 1 ? "" : "s"}`, "success");
            onApplied();
            setVisible(false);
        } catch {
            showToast("Couldn't apply those changes. Please try again.", "danger");
        } finally {
            setApplying(false);
        }
    }, [changes, updateTask, onApplied, setVisible]);

    const count = changes.length;
    const renderFooter = useCallback(
        (props: BottomSheetFooterProps) => {
            let button: React.ReactNode = null;
            if (stage === "intro") button = <PrimaryButton title="Look over my tasks" onPress={lookOver} />;
            else if (stage === "error") button = <PrimaryButton title="Try again" onPress={lookOver} />;
            else if (stage === "review" && preview && preview.changes.length > 0)
                button = (
                    <PrimaryButton
                        title={applying ? "Applying..." : count === 0 ? "Nothing to apply" : `Apply to ${count} task${count === 1 ? "" : "s"}`}
                        onPress={apply}
                        disabled={applying || count === 0}
                    />
                );
            if (!button) return null;
            return (
                <BottomSheetFooter {...props} bottomInset={insets.bottom}>
                    <View style={[styles.footer, { backgroundColor: ThemedColor.background }]}>{button}</View>
                </BottomSheetFooter>
            );
        },
        [stage, preview, applying, count, apply, lookOver, insets.bottom, ThemedColor]
    );

    const introPoints = useMemo(() => {
        const n = status.candidateCount;
        const stale = status.staleCount;
        return [
            {
                Icon: CalendarDotsIcon,
                text: `Give your ${n} unplanned task${n === 1 ? "" : "s"} a day in the next two weeks${stale > 0 ? `, ${stale} of them overdue` : ""}`,
            },
            { Icon: ClockIcon, text: "Add a time or due date where the title implies one" },
            { Icon: FlagIcon, text: "Set priority or difficulty when it's obvious" },
            { Icon: TextAaIcon, text: "Fix casing and typos, keeping your words" },
        ];
    }, [status]);

    return (
        <DefaultModal visible={visible} setVisible={setVisible} snapPoints={stage === "intro" ? ["60%"] : ["85%"]} topInset={insets.top} footerComponent={renderFooter}>
            {/* One scroll view for every stage, so long lists and small screens
                always reach the end. A flat contentContainerStyle lets gorhom add
                the footer's height to paddingBottom. */}
            <BottomSheetScrollView style={styles.flex} contentContainerStyle={scrollContent} showsVerticalScrollIndicator={false}>
                <ThemedText type="fancyFrauncesSubheading" style={styles.heading}>
                    Tidy up your tasks
                </ThemedText>
                <MotiView key={stage} from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: "timing", duration: 180 }}>
                    {stage === "intro" && (
                        <View style={styles.section}>
                            {introPoints.map(({ Icon, text }) => (
                                <View key={text} style={styles.point}>
                                    <View style={[styles.pointIcon, { backgroundColor: ThemedColor.primary + "1A" }]}>
                                        <Icon size={18} color={ThemedColor.primary} />
                                    </View>
                                    <ThemedText type="default" style={styles.pointText}>
                                        {text}
                                    </ThemedText>
                                </View>
                            ))}
                            {somedayCount > 0 && (
                                <TouchableOpacity
                                    style={styles.point}
                                    onPress={() => {
                                        hapticLight();
                                        setVisible(false);
                                        setSelected("Someday");
                                    }}
                                    accessibilityRole="button"
                                    accessibilityLabel={`${somedayCount} someday task${somedayCount === 1 ? "" : "s"} might be ready for a day`}>
                                    <View style={[styles.pointIcon, { backgroundColor: ThemedColor.primary + "1A" }]}>
                                        <PlanetIcon size={18} color={ThemedColor.primary} />
                                    </View>
                                    <ThemedText type="default" style={[styles.pointText, { color: ThemedColor.primary }]}>
                                        Or take a look at your {somedayCount} someday task{somedayCount === 1 ? "" : "s"} — any ready for a day?
                                    </ThemedText>
                                </TouchableOpacity>
                            )}
                            <ThemedText type="caption" style={styles.note}>
                                You'll review every suggestion before anything changes.
                            </ThemedText>
                        </View>
                    )}

                    {stage === "loading" && (
                        <View style={styles.center}>
                            <ActivityIndicator color={ThemedColor.primary} />
                            <ThemedText type="caption">Looking over your tasks...</ThemedText>
                        </View>
                    )}

                    {stage === "error" && (
                        <View style={styles.center}>
                            <ThemedText type="caption">Couldn't look over your tasks right now.</ThemedText>
                        </View>
                    )}

                    {stage === "review" && preview && (
                        <View>
                            <ThemedText type="caption" style={styles.overview}>
                                {preview.overview}
                                {preview.changes.length > 0 ? " Tap the x on anything you don't want." : ""}
                            </ThemedText>
                            {changes.map((change) => (
                                <ChangeRow
                                    key={change.taskId}
                                    change={change}
                                    onDismiss={() => dismissTask(change.taskId)}
                                    onDismissPart={(index) => dismissPart(change.taskId, index)}
                                />
                            ))}
                            {(dismissedCount > 0 || editedCount > 0) && (
                                <TouchableOpacity onPress={() => setChanges(preview.changes)} hitSlop={8} style={styles.restore}>
                                    <ThemedText type="caption" style={{ color: ThemedColor.primary }}>
                                        Bring back everything I removed
                                    </ThemedText>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                </MotiView>
            </BottomSheetScrollView>
        </DefaultModal>
    );
}

const scrollContent = { paddingBottom: 16 };

function ChangeRow({ change, onDismiss, onDismissPart }: { change: EnrichChange; onDismiss: () => void; onDismissPart: (index: number) => void }) {
    const ThemedColor = useThemeColor();
    return (
        <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: "timing", duration: 160 }}
            style={[styles.change, { backgroundColor: ThemedColor.lightenedCard, borderColor: ThemedColor.tertiary }]}>
            <View style={styles.changeHeader}>
                <View style={styles.changeText}>
                    <ThemedText type="default" numberOfLines={2}>
                        {change.taskName}
                    </ThemedText>
                    {change.categoryName ? <ThemedText type="caption">{change.categoryName}</ThemedText> : null}
                </View>
                <TouchableOpacity onPress={onDismiss} hitSlop={12} accessibilityLabel={`Don't change ${change.taskName}`}>
                    <XIcon size={18} color={ThemedColor.caption} />
                </TouchableOpacity>
            </View>
            <View style={styles.parts}>
                {change.summary.map((label, index) => (
                    <View key={label} style={[styles.part, { borderColor: ThemedColor.tertiary }]}>
                        <ThemedText type="default" style={{ fontSize: 14, color: ThemedColor.primary }}>
                            {label}
                        </ThemedText>
                        {change.summary.length > 1 && (
                            <TouchableOpacity onPress={() => onDismissPart(index)} hitSlop={8} accessibilityLabel={`Drop ${label}`}>
                                <XIcon size={12} color={ThemedColor.caption} />
                            </TouchableOpacity>
                        )}
                    </View>
                ))}
            </View>
            {change.reason ? <ThemedText type="caption">{change.reason}</ThemedText> : null}
        </MotiView>
    );
}

const styles = StyleSheet.create({
    chip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingLeft: 14,
        paddingRight: 12,
        paddingVertical: 8,
        borderRadius: 100,
    },
    chipBody: { flexDirection: "row", alignItems: "center", gap: 6 },
    heading: {
        marginBottom: 16,
    },
    flex: {
        flex: 1,
    },
    section: {
        gap: 16,
    },
    pointIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
    point: {
        flexDirection: "row",
        gap: 14,
        alignItems: "center",
    },
    pointText: {
        flex: 1,
    },
    note: {
        marginTop: 8,
    },
    center: {
        alignItems: "center",
        gap: 12,
        paddingTop: 48,
    },
    overview: {
        marginBottom: 16,
    },
    change: {
        gap: 8,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 8,
    },
    changeHeader: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 12,
    },
    parts: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    part: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 8,
        borderWidth: 1,
    },
    restore: {
        alignSelf: "center",
        paddingVertical: 8,
    },
    changeText: {
        flex: 1,
        gap: 4,
    },
    footer: {
        paddingTop: 12,
        paddingBottom: 8,
        paddingHorizontal: 20,
    },
});

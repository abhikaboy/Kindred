import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BottomSheetFooter, BottomSheetScrollView, type BottomSheetFooterProps } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MotiView } from "moti";
import { CalendarCheckIcon, CheckCircleIcon, CircleIcon, MagicWandIcon, XIcon } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import DefaultModal from "@/components/modals/DefaultModal";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useAuth } from "@/hooks/useAuth";
import { useTaskActions } from "@/contexts/tasksContext";
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

/** Occasional home card that offers to schedule and fill in neglected tasks. */
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
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                        hapticLight();
                        setSheetVisible(true);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Tidy up your tasks"
                    style={[styles.card, { backgroundColor: ThemedColor.lightenedCard, borderColor: ThemedColor.tertiary }]}>
                    <MagicWandIcon size={22} weight="light" color={ThemedColor.primary} />
                    <View style={styles.cardText}>
                        <ThemedText type="defaultSemiBold">Tidy up your tasks</ThemedText>
                        <ThemedText type="caption">
                            {count} task{count === 1 ? " has" : "s have"} no day planned. Kindred can suggest one for each.
                        </ThemedText>
                    </View>
                    <TouchableOpacity onPress={markHandled} hitSlop={12} accessibilityLabel="Not now">
                        <XIcon size={16} color={ThemedColor.caption} />
                    </TouchableOpacity>
                </TouchableOpacity>
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

function AutoEnrichSheet({ visible, setVisible, status, onApplied }: SheetProps) {
    const ThemedColor = useThemeColor();
    const insets = useSafeAreaInsets();
    const { updateTask } = useTaskActions();
    const [stage, setStage] = useState<Stage>("intro");
    const [preview, setPreview] = useState<EnrichPreview | null>(null);
    const [kept, setKept] = useState<Set<string>>(new Set());
    const [applying, setApplying] = useState(false);

    const lookOver = useCallback(async () => {
        setStage("loading");
        try {
            const next = await previewEnrichAPI();
            setPreview(next);
            setKept(new Set(next.changes.map((c) => c.taskId)));
            setStage("review");
        } catch {
            setStage("error");
        }
    }, []);

    const toggle = (taskId: string) => {
        hapticLight();
        setKept((prev) => {
            const next = new Set(prev);
            if (next.has(taskId)) next.delete(taskId);
            else next.add(taskId);
            return next;
        });
    };

    const apply = useCallback(async () => {
        if (!preview) return;
        const changes = preview.changes.filter((c) => kept.has(c.taskId));
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
    }, [preview, kept, updateTask, onApplied, setVisible]);

    const keptCount = kept.size;
    const renderFooter = useCallback(
        (props: BottomSheetFooterProps) => {
            let button: React.ReactNode = null;
            if (stage === "intro") button = <PrimaryButton title="Look over my tasks" onPress={lookOver} />;
            else if (stage === "error") button = <PrimaryButton title="Try again" onPress={lookOver} />;
            else if (stage === "review" && preview && preview.changes.length > 0)
                button = (
                    <PrimaryButton
                        title={applying ? "Applying..." : `Apply ${keptCount} change${keptCount === 1 ? "" : "s"}`}
                        onPress={apply}
                        disabled={applying || keptCount === 0}
                    />
                );
            if (!button) return null;
            return (
                <BottomSheetFooter {...props} bottomInset={insets.bottom}>
                    <View style={[styles.footer, { backgroundColor: ThemedColor.background, borderTopColor: ThemedColor.tertiary }]}>{button}</View>
                </BottomSheetFooter>
            );
        },
        [stage, preview, applying, keptCount, apply, lookOver, insets.bottom, ThemedColor]
    );

    const introPoints = useMemo(() => {
        const stale = status.staleCount;
        return [
            `Look over the ${status.candidateCount} open task${status.candidateCount === 1 ? "" : "s"} with no day planned${stale > 0 ? `, including ${stale} that slipped past their day` : ""}.`,
            "Suggest a day for each over the next two weeks, spread around what you already have planned.",
            "Add a due date or time only where the title implies one, and set priority or difficulty only where it is obvious.",
            "Fix small title issues like casing and typos, keeping your words.",
        ];
    }, [status]);

    return (
        <DefaultModal visible={visible} setVisible={setVisible} snapPoints={["85%"]} topInset={insets.top} footerComponent={renderFooter}>
            <ThemedText type="fancyFrauncesSubheading" style={styles.heading}>
                Tidy up your tasks
            </ThemedText>
            <MotiView key={stage} from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: "timing", duration: 180 }} style={styles.flex}>
                {stage === "intro" && (
                    <View style={styles.section}>
                        <ThemedText type="default" style={styles.sectionTitle}>
                            Here is what Kindred will do
                        </ThemedText>
                        {introPoints.map((point) => (
                            <View key={point} style={styles.point}>
                                <CalendarCheckIcon size={18} weight="light" color={ThemedColor.primary} />
                                <ThemedText type="caption" style={styles.pointText}>
                                    {point}
                                </ThemedText>
                            </View>
                        ))}
                        <ThemedText type="caption" style={styles.note}>
                            Nothing changes yet. You will see every suggestion and can drop any of them before applying.
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
                    <BottomSheetScrollView style={styles.flex} contentContainerStyle={{ paddingBottom: 96 }}>
                        <ThemedText type="caption" style={styles.overview}>
                            {preview.overview}
                        </ThemedText>
                        {preview.changes.map((change) => (
                            <ChangeRow key={change.taskId} change={change} kept={kept.has(change.taskId)} onToggle={() => toggle(change.taskId)} />
                        ))}
                    </BottomSheetScrollView>
                )}
            </MotiView>
        </DefaultModal>
    );
}

function ChangeRow({ change, kept, onToggle }: { change: EnrichChange; kept: boolean; onToggle: () => void }) {
    const ThemedColor = useThemeColor();
    return (
        <TouchableOpacity
            onPress={onToggle}
            activeOpacity={0.7}
            style={[styles.change, { backgroundColor: ThemedColor.lightenedCard, borderColor: ThemedColor.tertiary, opacity: kept ? 1 : 0.5 }]}>
            {kept ? <CheckCircleIcon size={22} weight="fill" color={ThemedColor.primary} /> : <CircleIcon size={22} color={ThemedColor.caption} />}
            <View style={styles.changeText}>
                <ThemedText type="default" numberOfLines={1}>
                    {change.taskName}
                </ThemedText>
                <ThemedText type="default" style={{ fontSize: 14, color: ThemedColor.primary }}>
                    {change.summary.join("  ·  ")}
                </ThemedText>
                {change.reason ? <ThemedText type="caption">{change.reason}</ThemedText> : null}
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        marginHorizontal: HORIZONTAL_PADDING,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
    },
    cardText: {
        flex: 1,
        gap: 4,
    },
    heading: {
        marginBottom: 16,
    },
    flex: {
        flex: 1,
    },
    section: {
        gap: 12,
    },
    sectionTitle: {
        fontSize: 17,
    },
    point: {
        flexDirection: "row",
        gap: 12,
        alignItems: "flex-start",
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
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 12,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 8,
    },
    changeText: {
        flex: 1,
        gap: 4,
    },
    footer: {
        paddingTop: 12,
        paddingBottom: 8,
        paddingHorizontal: 20,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
});

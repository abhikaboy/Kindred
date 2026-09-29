import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, TouchableOpacity, View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomSheetScrollView, BottomSheetTextInput } from "@gorhom/bottom-sheet";
import Animated, {
    FadeIn,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from "react-native-reanimated";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { CalendarBlank, CaretLeft, Clock, Moon, Plus, SunHorizon, X, type IconProps } from "phosphor-react-native";
import { hideToastable, showToastable } from "react-native-toastable";
import type ConfettiCannon from "react-native-confetti-cannon";
import DefaultModal from "@/components/modals/DefaultModal";
import DefaultToast from "@/components/ui/DefaultToast";
import SegmentedControl from "@/components/ui/SegmentedControl";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { ThemedText } from "@/components/ThemedText";
import CheckPad from "./CheckPad";
import PlanConfetti from "./PlanConfetti";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useAnalytics } from "@/hooks/useAnalytics";
import { closePlanSheet, usePlanSheet } from "@/hooks/planSheetStore";
import { useTaskActions, useTasksSelector } from "@/contexts/tasksContext";
import {
    clearTaskPlanAPI,
    getBreakdownSuggestionsAPI,
    parkTaskAPI,
    releaseTaskAPI,
    setTaskPlanAPI,
    type PlanSize,
} from "@/api/plan";
import { markInProgressAPI, setWorkingAPI } from "@/api/task";
import { ActiveTaskActivityFactory } from "@/widgets/widgetUpdaters";
import type { ChecklistItem, Task } from "@/api/types";
import { AnalyticsEvents } from "@/utils/analytics";
import { hapticLight, hapticSuccess } from "@/utils/haptics";
import { showToast } from "@/utils/showToast";
import { snoozeTask } from "@/utils/planSnooze";
import { tasksOnDay, PLAN_DAY_CAPACITY } from "@/utils/planCapacity";
import { capitalize, planDayLabel, planWhenDate, planWhenPhrase, type PlanWhenKey } from "@/utils/planWhen";

const SIZE_OPTIONS = ["Small", "Medium", "Large"];
const SIZE_BY_LABEL: Record<string, PlanSize> = { Small: "2m", Medium: "10m", Large: "full" };
const LABEL_BY_SIZE: Record<PlanSize, string> = { "2m": "Small", "10m": "Medium", full: "Large" };
const MAX_STEPS = 6;
const FADE = FadeIn.duration(180);

const WHEN_CHIPS: { key: PlanWhenKey; label: string; Icon: React.ComponentType<IconProps> }[] = [
    { key: "tonight", label: "Tonight", Icon: Moon },
    { key: "tomorrow", label: "Tomorrow", Icon: SunHorizon },
    { key: "weekend", label: "This weekend", Icon: CalendarBlank },
    { key: "picked", label: "Pick time", Icon: Clock },
];

type Page = 1 | 2 | 3;

const openChecklist = (task: Task) =>
    (task.checklist ?? [])
        .filter((c) => !c.completed && c.content.trim())
        .sort((a, b) => a.order - b.order)
        .map((c) => c.content.trim());

/** Local mirror of the backend's appendPlanSteps: add new steps to the end, skipping ones already there. */
const mergeChecklist = (checklist: ChecklistItem[] = [], steps: string[]): ChecklistItem[] => {
    const seen = new Set(checklist.map((c) => c.content.trim().toLowerCase()));
    let order = checklist.reduce((max, c) => Math.max(max, c.order + 1), 0);
    const out = [...checklist];
    for (const s of steps) {
        const key = s.toLowerCase();
        if (!s || seen.has(key)) continue;
        seen.add(key);
        out.push({ content: s, completed: false, order: order++ });
    }
    return out;
};

/** Numbered, editable step row. */
function StepRow({
    index,
    value,
    autoFocus,
    onChange,
    onRemove,
    onSubmit,
}: {
    index: number;
    value: string;
    autoFocus: boolean;
    onChange: (v: string) => void;
    onRemove: () => void;
    onSubmit: () => void;
}) {
    const ThemedColor = useThemeColor();
    const dark = useColorScheme() === "dark";
    return (
        <View style={styles.stepRow}>
            <ThemedText type="caption" style={styles.stepNumber}>
                {index + 1}
            </ThemedText>
            <BottomSheetTextInput
                value={value}
                onChangeText={onChange}
                autoFocus={autoFocus}
                placeholder={index === 0 ? "A small first step" : "Then..."}
                placeholderTextColor={ThemedColor.caption}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={onSubmit}
                style={[
                    styles.stepInput,
                    { color: ThemedColor.text },
                    dark
                        ? { backgroundColor: ThemedColor.tertiary, borderColor: "transparent" }
                        : { backgroundColor: ThemedColor.background, borderColor: ThemedColor.tertiary },
                ]}
            />
            <TouchableOpacity onPress={onRemove} hitSlop={8} style={styles.iconButton} accessibilityLabel="Remove step">
                <X size={18} color={ThemedColor.caption} />
            </TouchableOpacity>
        </View>
    );
}

function Shimmer() {
    const ThemedColor = useThemeColor();
    const opacity = useSharedValue(0.5);
    useEffect(() => {
        opacity.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
    }, []);
    const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
    return (
        <View style={styles.list}>
            {[0, 1, 2].map((i) => (
                <Animated.View key={i} style={[styles.shimmer, { backgroundColor: ThemedColor.lightened }, style]} />
            ))}
        </View>
    );
}

function BackLink({ label, onPress }: { label: string; onPress: () => void }) {
    const ThemedColor = useThemeColor();
    return (
        <TouchableOpacity onPress={onPress} hitSlop={8} style={styles.back} accessibilityRole="button">
            <CaretLeft size={16} color={ThemedColor.caption} />
            <ThemedText type="caption" numberOfLines={1} style={{ flexShrink: 1 }}>
                {label}
            </ThemedText>
        </TouchableOpacity>
    );
}

function QuietVerb({ label, onPress }: { label: string; onPress: () => void }) {
    const ThemedColor = useThemeColor();
    return (
        <TouchableOpacity onPress={onPress} hitSlop={8} style={styles.verb} accessibilityRole="button">
            <ThemedText type="smallerDefault" style={{ color: ThemedColor.caption }}>
                {label}
            </ThemedText>
        </TouchableOpacity>
    );
}

function PlannedToast({ message, onUndo }: { message: string; onUndo: () => void }) {
    const ThemedColor = useThemeColor();
    return (
        <View style={styles.toastWrap}>
            <View style={[styles.toastBody, { backgroundColor: ThemedColor.lightened }]}>
                <ThemedText type="default" style={{ flexShrink: 1 }}>
                    {message}
                </ThemedText>
                <TouchableOpacity onPress={onUndo} hitSlop={8}>
                    <ThemedText type="smallerDefault" style={{ color: ThemedColor.primary }}>
                        Undo
                    </ThemedText>
                </TouchableOpacity>
            </View>
        </View>
    );
}

/**
 * Build a plan: break a waiting task into small steps, pick when to start, and
 * commit with a drawn check. Mounted once in the logged-in layout; any surface
 * opens it through openPlanSheet().
 */
export default function BuildPlanSheet() {
    const request = usePlanSheet();
    const ThemedColor = useThemeColor();
    const insets = useSafeAreaInsets();
    const { capture } = useAnalytics();
    const { updateTask } = useTaskActions();
    const allTasks = useTasksSelector((s) => s.allTasks);
    const confettiRef = useRef<ConfettiCannon>(null);

    // Keep the last task around so content doesn't blank while the sheet slides away
    const [task, setTask] = useState<Task | null>(null);
    const [page, setPage] = useState<Page>(1);
    const [size, setSize] = useState<PlanSize>("10m");
    const [steps, setSteps] = useState<string[]>([""]);
    const [loading, setLoading] = useState(false);
    const [focusIndex, setFocusIndex] = useState(-1);
    const [whenKey, setWhenKey] = useState<PlanWhenKey | null>(null);
    const [pickedAt, setPickedAt] = useState<Date | null>(null);
    const [picking, setPicking] = useState(false);
    const [parkedIds, setParkedIds] = useState<string[]>([]);
    const [done, setDone] = useState(false);
    const fetchSeq = useRef(0);
    const committed = useRef(false);
    const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const categoryId = task?.categoryID ?? "";

    const loadSteps = useCallback(async (t: Task, s: PlanSize) => {
        const seq = ++fetchSeq.current;
        setLoading(true);
        const { steps: suggested } = await getBreakdownSuggestionsAPI(t.categoryID ?? "", t.id, s);
        if (seq !== fetchSeq.current) return; // a newer size won
        setSteps(suggested.length ? suggested.slice(0, MAX_STEPS) : [""]);
        setLoading(false);
    }, []);

    // A new request resets the flow
    useEffect(() => {
        if (!request) return;
        clearTimeout(closeTimer.current);
        const t = request.task;
        const s = request.size ?? "10m";
        setTask(t);
        setPage(1);
        setSize(s);
        setFocusIndex(-1);
        setWhenKey(request.when ?? null);
        setPickedAt(null);
        setPicking(false);
        setParkedIds([]);
        setDone(false);
        committed.current = false;
        const existing = openChecklist(t);
        if (existing.length) {
            // Unchecked checklist items are already a breakdown; start from them
            fetchSeq.current++;
            setLoading(false);
            setSteps(existing.slice(0, MAX_STEPS));
        } else {
            loadSteps(t, s);
        }
    }, [request, loadSteps]);

    useEffect(() => () => clearTimeout(closeTimer.current), []);

    const filled = useMemo(() => steps.map((s) => s.trim()).filter(Boolean), [steps]);
    const firstStep = filled[0] ?? "";

    const whenDate = useMemo(
        () => (whenKey ? planWhenDate(whenKey, new Date(), pickedAt ?? undefined) : null),
        [whenKey, pickedAt]
    );
    const whenPhrase = whenKey && whenDate ? planWhenPhrase(whenKey, whenDate) : "";

    // Capacity gate: the chosen day's timed or planned tasks, keeping ones parked here visible
    const dayTasks = useMemo(() => {
        if (!whenDate || !task) return [];
        const live = tasksOnDay(allTasks, whenDate, task.id);
        const parked = allTasks.filter((t) => parkedIds.includes(t.id) && !live.some((l) => l.id === t.id));
        return [...live, ...parked.filter((t, i, a) => a.findIndex((x) => x.id === t.id) === i)];
    }, [allTasks, whenDate, task, parkedIds]);
    const liveCount = dayTasks.filter((t) => !parkedIds.includes(t.id)).length;
    const gated = !!whenDate && liveCount >= PLAN_DAY_CAPACITY && parkedIds.length === 0;

    const setVisible = useCallback((v: boolean) => {
        if (!v) closePlanSheet();
    }, []);

    // --- Page 1 ---

    const onSize = (label: string) => {
        const s = SIZE_BY_LABEL[label];
        if (!task || s === size) return;
        setSize(s);
        loadSteps(task, s);
    };

    const updateStep = (i: number, v: string) => setSteps((prev) => prev.map((s, j) => (j === i ? v : s)));
    const removeStep = (i: number) =>
        setSteps((prev) => {
            const next = prev.filter((_, j) => j !== i);
            return next.length ? next : [""];
        });
    const addStep = () => {
        if (steps.length >= MAX_STEPS) return;
        setFocusIndex(steps.length);
        setSteps((prev) => [...prev, ""]);
    };

    const notNow = () => {
        if (!task) return;
        snoozeTask(task.id);
        capture(AnalyticsEvents.PLAN_SNOOZED, {});
        closePlanSheet();
    };

    const letItGo = () => {
        if (!task) return;
        const t = task;
        const prev = t.releasedAt ?? null;
        updateTask(categoryId, t.id, { releasedAt: new Date().toISOString() });
        closePlanSheet();
        capture(AnalyticsEvents.TASK_RELEASED, {});
        showToast("Let go. You can bring it back anytime.", "success");
        releaseTaskAPI(categoryId, t.id).catch(() => {
            updateTask(categoryId, t.id, { releasedAt: prev });
            showToast("Couldn't let it go. Give it another try.", "danger");
        });
    };

    // --- Page 2 ---

    const chooseWhen = (key: PlanWhenKey, picked?: Date) => {
        setWhenKey(key);
        setParkedIds([]);
        if (!task) return;
        const date = planWhenDate(key, new Date(), picked);
        if (tasksOnDay(allTasks, date, task.id).length < PLAN_DAY_CAPACITY) setPage(3);
    };

    const onChip = (key: PlanWhenKey) => {
        if (key !== "picked") {
            setPicking(false);
            chooseWhen(key);
            return;
        }
        const initial = pickedAt ?? planWhenDate("picked", new Date());
        if (Platform.OS === "android") {
            DateTimePickerAndroid.open({
                value: initial,
                mode: "date",
                minimumDate: new Date(),
                onChange: (e, date) => {
                    if (e.type !== "set" || !date) return;
                    DateTimePickerAndroid.open({
                        value: date,
                        mode: "time",
                        onChange: (e2, time) => {
                            if (e2.type !== "set" || !time) return;
                            setPickedAt(time);
                            chooseWhen("picked", time);
                        },
                    });
                },
            });
            return;
        }
        setPickedAt(initial);
        setWhenKey("picked");
        setParkedIds([]);
        setPicking(true);
    };

    const park = (t: Task) => {
        if (parkedIds.includes(t.id)) return;
        const cat = t.categoryID ?? "";
        const prev = t.parkedAt ?? null;
        setParkedIds((ids) => [...ids, t.id]);
        updateTask(cat, t.id, { parkedAt: new Date().toISOString() });
        parkTaskAPI(cat, t.id).catch(() => {
            updateTask(cat, t.id, { parkedAt: prev });
            setParkedIds((ids) => ids.filter((id) => id !== t.id));
            showToast("Couldn't park that one. Give it another try.", "danger");
        });
        setPage(3);
    };

    // --- Commit ---

    const savePlan = (at: Date, extra: Partial<Task> = {}) => {
        if (!task) return;
        const t = task;
        const prevPlan = t.plan ?? null;
        const prevChecklist = t.checklist;
        const iso = at.toISOString();
        updateTask(categoryId, t.id, {
            plan: { step: firstStep, size, at: iso, committedAt: new Date().toISOString() },
            startDate: iso,
            startTime: iso,
            checklist: mergeChecklist(t.checklist, filled),
            ...extra,
        });
        setTaskPlanAPI(categoryId, t.id, { step: firstStep, size, at, steps: filled }).catch(() => {
            updateTask(categoryId, t.id, { plan: prevPlan, checklist: prevChecklist, startDate: t.startDate, startTime: t.startTime });
            showToast("Couldn't save the plan. Give it another try.", "danger");
        });
        return { t, prevPlan };
    };

    const commit = () => {
        if (!task || !whenDate || !whenKey || committed.current || !firstStep) return;
        committed.current = true;
        setDone(true);
        hapticSuccess();
        confettiRef.current?.start();
        const saved = savePlan(whenDate);
        capture(AnalyticsEvents.PLAN_BUILT, { size, when: whenKey, steps: filled.length });
        const phrase = whenPhrase;
        // Let the check and burst land before the sheet slides away; input isn't blocked meanwhile
        closeTimer.current = setTimeout(() => {
            closePlanSheet();
            if (!saved) return;
            const undo = () => {
                hideToastable();
                updateTask(categoryId, saved.t.id, { plan: saved.prevPlan });
                clearTaskPlanAPI(categoryId, saved.t.id).catch(() => {});
            };
            showToastable({
                message: `Planned for ${phrase}.`,
                status: "success",
                duration: 4000,
                swipeDirection: "up",
                renderContent: () => <PlannedToast message={`Planned for ${phrase}.`} onUndo={undo} />,
            });
        }, 700);
    };

    const startNow = () => {
        if (!task || !firstStep || committed.current) return;
        committed.current = true;
        const t = task;
        const now = new Date();
        hapticLight();
        savePlan(now, { workingOnSince: now.toISOString(), active: true });
        capture(AnalyticsEvents.PLAN_BUILT, { size, when: "now", steps: filled.length });
        // Same start flow as TaskCard: Live Activity, working state and In Progress
        ActiveTaskActivityFactory.start({
            taskName: t.content,
            workspaceName: t.workspaceName || "Tasks",
            startTime: now.toISOString(),
            endTime: t.deadline || undefined,
            hasEndTime: !!t.deadline,
            categoryId,
            taskId: t.id,
        });
        setWorkingAPI(categoryId, t.id, true).catch(() => {});
        markInProgressAPI(categoryId, t.id).catch(() => {});
        closePlanSheet();
        showToastable({
            message: `Now working on "${firstStep}"`,
            status: "success",
            duration: 2500,
            renderContent: (props) => <DefaultToast {...props} />,
        });
    };

    // --- Render ---

    const sectionTitle = (text: string) => (
        <ThemedText type="default" style={styles.sectionTitle}>
            {text}
        </ThemedText>
    );

    const renderPage1 = () => (
        <>
            <ThemedText type="fancyFrauncesSubheading">{task?.content}</ThemedText>
            <View style={styles.block}>
                {sectionTitle("How should we break it down?")}
                <SegmentedControl options={SIZE_OPTIONS} selectedOption={LABEL_BY_SIZE[size]} onOptionPress={onSize} accent />
            </View>
            <View style={styles.block}>
                {loading ? (
                    <Shimmer />
                ) : (
                    <Animated.View entering={FADE}>
                        <View style={styles.list}>
                            {steps.map((s, i) => (
                                <StepRow
                                    key={i}
                                    index={i}
                                    value={s}
                                    autoFocus={i === focusIndex}
                                    onChange={(v) => updateStep(i, v)}
                                    onRemove={() => removeStep(i)}
                                    onSubmit={addStep}
                                />
                            ))}
                        </View>
                        {steps.length < MAX_STEPS && (
                            <TouchableOpacity onPress={addStep} hitSlop={8} style={styles.textLink} accessibilityRole="button">
                                <Plus size={14} color={ThemedColor.primary} />
                                <ThemedText type="smallerDefault" style={{ color: ThemedColor.primary }}>
                                    Add a step
                                </ThemedText>
                            </TouchableOpacity>
                        )}
                        <PrimaryButton
                            title={`Add ${filled.length} ${filled.length === 1 ? "step" : "steps"} to ${task?.content ?? ""}`}
                            onPress={() => setPage(2)}
                            disabled={filled.length === 0}
                            style={{ ...styles.primary, ...(filled.length === 0 ? styles.disabled : null) }}
                        />
                    </Animated.View>
                )}
            </View>
            <View style={styles.verbs}>
                <QuietVerb label="Not now" onPress={notNow} />
                <ThemedText type="caption">·</ThemedText>
                <QuietVerb label="Let it go" onPress={letItGo} />
            </View>
        </>
    );

    const renderPage2 = () => (
        <>
            <BackLink label={task?.content ?? ""} onPress={() => setPage(1)} />
            <ThemedText type="fancyFrauncesSubheading">{firstStep}</ThemedText>
            <ThemedText type="caption" style={styles.captionUnder}>
                Step 1 of {filled.length}
            </ThemedText>
            <View style={styles.block}>
                {sectionTitle("When do you want to start?")}
                <View style={styles.chips}>
                    {WHEN_CHIPS.map(({ key, label, Icon }) => {
                        const on = whenKey === key;
                        const color = on ? ThemedColor.primary : ThemedColor.text;
                        return (
                            <TouchableOpacity
                                key={key}
                                onPress={() => onChip(key)}
                                style={[styles.chip, { backgroundColor: on ? ThemedColor.primary + "1F" : ThemedColor.lightened }]}
                                accessibilityRole="button"
                                accessibilityState={{ selected: on }}>
                                <Icon size={16} color={color} />
                                <ThemedText type="smallerDefault" style={{ color }}>
                                    {label}
                                </ThemedText>
                            </TouchableOpacity>
                        );
                    })}
                </View>
                {picking && Platform.OS === "ios" && pickedAt && (
                    <Animated.View entering={FADE}>
                        <DateTimePicker
                            value={pickedAt}
                            mode="datetime"
                            display="spinner"
                            minimumDate={new Date()}
                            minuteInterval={5}
                            textColor={ThemedColor.text}
                            onChange={(_, d) => d && setPickedAt(d)}
                        />
                        <TouchableOpacity
                            onPress={() => {
                                setPicking(false);
                                chooseWhen("picked", pickedAt);
                            }}
                            hitSlop={8}
                            style={styles.textLink}
                            accessibilityRole="button">
                            <ThemedText type="smallerDefault" style={{ color: ThemedColor.primary }}>
                                {capitalize(planWhenPhrase("picked", pickedAt))}
                            </ThemedText>
                        </TouchableOpacity>
                    </Animated.View>
                )}
                {gated && !picking && whenDate && (
                    <Animated.View entering={FADE} style={styles.gate}>
                        <ThemedText type="smallerDefault">
                            {planDayLabel(whenDate)}'s already full. Swap with one, or pick another day.
                        </ThemedText>
                        <View style={styles.swapList}>
                            {dayTasks.map((t, i) => {
                                const parked = parkedIds.includes(t.id);
                                return (
                                    <TouchableOpacity
                                        key={t.id}
                                        onPress={() => park(t)}
                                        disabled={parked}
                                        style={[
                                            styles.swapRow,
                                            i < dayTasks.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: ThemedColor.tertiary },
                                        ]}
                                        accessibilityRole="button">
                                        <ThemedText type="default" numberOfLines={1} style={{ flex: 1 }}>
                                            {t.content}
                                        </ThemedText>
                                        <ThemedText type="smallerDefault" style={{ color: parked ? ThemedColor.caption : ThemedColor.primary }}>
                                            {parked ? "Parked" : "Park this"}
                                        </ThemedText>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </Animated.View>
                )}
            </View>
            <View style={styles.verbs}>
                <QuietVerb label="Start it now instead" onPress={startNow} />
            </View>
        </>
    );

    const renderPage3 = () => (
        <>
            <BackLink
                label="When"
                onPress={() => {
                    setPage(2);
                    setWhenKey(null);
                    setParkedIds([]);
                }}
            />
            <ThemedText type="fancyFrauncesSubheading">{firstStep}</ThemedText>
            <ThemedText type="caption" style={styles.captionUnder}>
                {capitalize(whenPhrase)}
            </ThemedText>
            <CheckPad done={done} onCheck={commit} />
            <View style={styles.verbs}>
                <QuietVerb label="Just tap to commit" onPress={commit} />
            </View>
        </>
    );

    return (
        <>
            <DefaultModal
                visible={!!request}
                setVisible={setVisible}
                enableContentPanningGesture={false}
                keyboardBehavior="fillParent"
                topInset={insets.top}
                snapPoints={["88%"]}>
                <BottomSheetScrollView
                    contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled">
                    {task && (
                        <Animated.View key={page} entering={FADE}>
                            {page === 1 ? renderPage1() : page === 2 ? renderPage2() : renderPage3()}
                        </Animated.View>
                    )}
                </BottomSheetScrollView>
            </DefaultModal>
            <PlanConfetti ref={confettiRef} />
        </>
    );
}

const styles = StyleSheet.create({
    block: {
        marginTop: 24,
    },
    sectionTitle: {
        fontSize: 17,
        lineHeight: 24,
        marginBottom: 12,
    },
    list: {
        gap: 8,
    },
    shimmer: {
        height: 48,
        borderRadius: 12,
    },
    stepRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    stepNumber: {
        width: 20,
        textAlign: "center",
    },
    stepInput: {
        flex: 1,
        height: 48,
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 16,
        fontSize: 16,
        fontFamily: "OutfitLight",
    },
    iconButton: {
        padding: 4,
    },
    textLink: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        marginTop: 12,
        alignSelf: "flex-start",
    },
    primary: {
        marginTop: 16,
    },
    disabled: {
        opacity: 0.4,
        shadowOpacity: 0,
    },
    verbs: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        gap: 12,
        marginTop: 16,
    },
    verb: {
        padding: 4,
    },
    back: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        marginBottom: 8,
        alignSelf: "flex-start",
    },
    captionUnder: {
        marginTop: 4,
    },
    chips: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    chip: {
        height: 40,
        paddingHorizontal: 16,
        borderRadius: 999,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    gate: {
        marginTop: 12,
    },
    swapList: {
        marginTop: 8,
    },
    swapRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        paddingVertical: 12,
    },
    toastWrap: {
        paddingHorizontal: 20,
    },
    toastBody: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        borderRadius: 12,
        paddingVertical: 16,
        paddingHorizontal: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
        elevation: 6,
    },
});

import React, { useState } from "react";
import { Platform, StyleSheet, TouchableOpacity, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import Reanimated from "react-native-reanimated";
import { CaretLeft, CaretRight } from "phosphor-react-native";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/ThemedText";
import { SectionTitle } from "@/components/dashboard/SectionHeader";
import { SOFT_ENTER, STAGE } from "@/components/capture/CaptureStage";
import { useTaskCreation } from "@/contexts/taskCreationContext";
import { quickMoments } from "./quickMoments";

type Target = "start" | "due";
type Step = "day" | "time";

const WEEK_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];
// Parts of the day people mean; the wheel covers every other minute
const PARTS = [
    { label: "Morning", h: 9, m: 0 },
    { label: "Noon", h: 12, m: 0 },
    { label: "Afternoon", h: 15, m: 0 },
    { label: "Evening", h: 18, m: 0 },
    { label: "Night", h: 20, m: 0 },
];

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
const withTime = (day: Date, h: number, m: number) => {
    const d = new Date(day);
    d.setHours(h, m, 0, 0);
    return d;
};
const dayOnly = (d: Date) => withTime(d, 0, 0);
const fmtDay = (d: Date, now: Date) =>
    sameDay(d, now)
        ? "Today"
        : sameDay(d, new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1))
          ? "Tomorrow"
          : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
const fmtTime = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

type Props = {
    target: Target;
    onTargetChange: (target: Target) => void;
    /** Picking by tap takes precedence over the text parse. */
    onTouched: () => void;
    onDone: () => void;
    /** Hides the start/due switch, for editors that only own one of them. */
    lockTarget?: boolean;
    /** Someday is chosen: an undated task. */
    someday?: boolean;
    /** Offers "Someday" after the start moments; picking a day replaces it. */
    onSomeday?: () => void;
};

/**
 * Start / due editor on the stage, as two steps: pick the day, then the time
 * within it. The two-part header shows both and either can be reopened; picking
 * a day moves on to its time. Writes as it goes; Done adds the usual smart
 * reminders, as the old screens did.
 *
 * Start may have no time ("Any time"); a due date without one is due at the
 * end of that day.
 */
const DatePanel = ({ target, onTargetChange, onTouched, onDone, lockTarget, someday, onSomeday }: Props) => {
    const {
        startDate,
        startTime,
        setStartDate,
        setStartTime,
        deadline,
        setDeadline,
        addSmartStartReminders,
        addSmartDeadlineReminders,
    } = useTaskCreation();
    const now = new Date();
    const value = target === "start" ? startDate : deadline;
    const timed = target === "start" ? startTime !== null : true;
    const [step, setStep] = useState<Step>("day");
    // Android's picker is a dialog, so it only mounts when asked for
    const [androidClock, setAndroidClock] = useState(false);
    const inlineWheel = Platform.OS === "ios";
    const [month, setMonth] = useState(() => {
        const d = new Date(value ?? now);
        d.setDate(1);
        return dayOnly(d);
    });

    const write = (at: Date | null, withClock: boolean) => {
        onTouched();
        if (target === "start") {
            setStartDate(at ? (withClock ? at : dayOnly(at)) : null);
            setStartTime(at && withClock ? at : null);
        } else {
            setDeadline(at);
        }
    };

    // Step 1 → 2: keep the time already chosen, if any, on the new day
    const pickDay = (day: Date) => {
        Haptics.selectionAsync();
        if (value && timed) write(withTime(day, value.getHours(), value.getMinutes()), true);
        else if (target === "due") write(withTime(day, 23, 59), true);
        else write(day, false);
        setStep("time");
    };

    const pickTime = (h: number, m: number) => write(withTime(value ?? now, h, m), true);

    const finish = () => {
        if (target === "start" && startDate) addSmartStartReminders(startDate, startTime);
        if (target === "due" && deadline) addSmartDeadlineReminders(deadline);
        onDone();
    };

    const switchTarget = (t: Target) => {
        onTargetChange(t);
        setStep("day");
    };

    const pill = (selected: boolean) => [styles.pill, { backgroundColor: selected ? STAGE.selected : STAGE.fill }];
    const ink = (selected: boolean) => ({ color: selected ? STAGE.onSelected : STAGE.text });

    // Month grid, Sunday first, padded to whole weeks
    const first = month.getDay();
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const cells: (Date | null)[] = [
        ...Array.from({ length: first }, () => null),
        ...Array.from({ length: daysInMonth }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
    ];
    while (cells.length % 7) cells.push(null);
    const shiftMonth = (by: number) => {
        Haptics.selectionAsync();
        setMonth(new Date(month.getFullYear(), month.getMonth() + by, 1));
    };

    // Two-part header: what's chosen so far, each part reopens its step
    const summaryPart = (s: Step, label: string, text: string) => {
        const current = step === s;
        return (
            <TouchableOpacity
                onPress={() => {
                    if (s === "time" && !value) return;
                    Haptics.selectionAsync();
                    setStep(s);
                }}
                style={[styles.part, { backgroundColor: current ? STAGE.selected : STAGE.fill }]}
                accessibilityRole="button"
                accessibilityState={{ selected: current }}
                accessibilityLabel={`${label}: ${text}`}>
                <ThemedText type="caption" style={{ color: current ? STAGE.onSelected : STAGE.muted }}>
                    {label}
                </ThemedText>
                <ThemedText type="default" numberOfLines={1} style={ink(current)}>
                    {text}
                </ThemedText>
            </TouchableOpacity>
        );
    };

    const dueEndOfDay = target === "due" && !!value && value.getHours() === 23 && value.getMinutes() === 59;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                {lockTarget ? (
                    <SectionTitle title={target === "start" ? "Start" : "Due"} style={{ color: STAGE.text }} />
                ) : (
                <View style={[styles.segment, { backgroundColor: STAGE.fill }]}>
                    {(["start", "due"] as const).map((t) => (
                        <TouchableOpacity
                            key={t}
                            onPress={() => switchTarget(t)}
                            accessibilityRole="button"
                            accessibilityState={{ selected: target === t }}
                            style={[styles.segmentOption, target === t && { backgroundColor: STAGE.selected }]}>
                            <ThemedText type="lightBody" style={ink(target === t)}>
                                {t === "start" ? "Start" : "Due"}
                            </ThemedText>
                        </TouchableOpacity>
                    ))}
                </View>
                )}
                <View style={styles.headerRight}>
                    {value && (
                        <TouchableOpacity
                            onPress={() => {
                                write(null, false);
                                setStep("day");
                            }}
                            hitSlop={8}
                            accessibilityRole="button">
                            <ThemedText type="lightBody" style={{ color: STAGE.muted }}>
                                Clear
                            </ThemedText>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={finish} hitSlop={8} accessibilityRole="button">
                        <ThemedText type="defaultSemiBold" style={{ color: STAGE.text }}>
                            Done
                        </ThemedText>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.parts}>
                {summaryPart("day", "Day", value ? fmtDay(value, now) : "Pick a day")}
                {summaryPart(
                    "time",
                    "Time",
                    !value ? "—" : !timed ? "Any time" : dueEndOfDay ? "End of day" : fmtTime(value)
                )}
            </View>

            {step === "day" ? (
                <Reanimated.View key="day" entering={SOFT_ENTER} style={styles.container}>
                    <View style={styles.wrap}>
                        {quickMoments(now, target).map((m) => {
                            const selected = !!value && value.getTime() === m.at.getTime();
                            return (
                                <TouchableOpacity
                                    key={m.key}
                                    onPress={() => {
                                        Haptics.selectionAsync();
                                        write(m.at, true);
                                        setMonth(dayOnly(new Date(m.at.getFullYear(), m.at.getMonth(), 1)));
                                        // The moment carries a time; show it so it can be nudged
                                        setStep("time");
                                    }}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected }}
                                    style={pill(selected)}>
                                    <ThemedText type="lightBody" style={ink(selected)}>
                                        {m.label}
                                    </ThemedText>
                                </TouchableOpacity>
                            );
                        })}
                        {target === "start" && onSomeday && (
                            <TouchableOpacity
                                key="someday"
                                onPress={onSomeday}
                                accessibilityRole="button"
                                accessibilityState={{ selected: !!someday }}
                                style={pill(!!someday)}>
                                <ThemedText type="lightBody" style={ink(!!someday)}>
                                    Someday
                                </ThemedText>
                            </TouchableOpacity>
                        )}
                    </View>

                    <View style={styles.monthHeader}>
                        <SectionTitle
                            title={month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                            style={{ color: STAGE.text }}
                        />
                        <View style={styles.headerRight}>
                            <TouchableOpacity
                                onPress={() => shiftMonth(-1)}
                                style={[styles.round, { backgroundColor: STAGE.fill }]}
                                accessibilityLabel="Previous month">
                                <CaretLeft size={14} color={STAGE.text} weight="bold" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => shiftMonth(1)}
                                style={[styles.round, { backgroundColor: STAGE.fill }]}
                                accessibilityLabel="Next month">
                                <CaretRight size={14} color={STAGE.text} weight="bold" />
                            </TouchableOpacity>
                        </View>
                    </View>
                    {/* One row per week with equal-share cells, so the month always spans the
                        full width (percent widths in a wrapping row round past 100% and drop Saturday) */}
                    <View>
                        <View style={styles.week}>
                            {WEEK_INITIALS.map((d, i) => (
                                <ThemedText
                                    key={i}
                                    type="caption"
                                    style={[styles.cell, styles.weekday, { color: STAGE.muted }]}>
                                    {d}
                                </ThemedText>
                            ))}
                        </View>
                        {Array.from({ length: cells.length / 7 }, (_, w) => (
                            <View key={w} style={styles.week}>
                                {cells.slice(w * 7, w * 7 + 7).map((day, i) => {
                                    if (!day) return <View key={`e${i}`} style={styles.cell} />;
                                    const selected = !!value && sameDay(value, day);
                                    const today = sameDay(day, now);
                                    const past = day < dayOnly(now);
                                    return (
                                        <TouchableOpacity
                                            key={day.toISOString()}
                                            onPress={() => pickDay(day)}
                                            style={styles.cell}
                                            accessibilityRole="button"
                                            accessibilityState={{ selected }}
                                            accessibilityLabel={day.toDateString()}>
                                            <View
                                                style={[
                                                    styles.day,
                                                    selected && { backgroundColor: STAGE.selected },
                                                    today && !selected && { borderColor: STAGE.faint, borderWidth: 1 },
                                                ]}>
                                                <ThemedText
                                                    type="lightBody"
                                                    style={{
                                                        color: selected
                                                            ? STAGE.onSelected
                                                            : past
                                                              ? STAGE.faint
                                                              : STAGE.text,
                                                    }}>
                                                    {day.getDate()}
                                                </ThemedText>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        ))}
                    </View>
                </Reanimated.View>
            ) : (
                <Reanimated.View key="time" entering={SOFT_ENTER} style={styles.container}>
                    <View style={styles.wrap}>
                        {target === "start" ? (
                            <TouchableOpacity
                                onPress={() => {
                                    Haptics.selectionAsync();
                                    write(value ?? now, false);
                                }}
                                style={pill(!timed)}
                                accessibilityRole="button">
                                <ThemedText type="lightBody" style={ink(!timed)}>
                                    Any time
                                </ThemedText>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                onPress={() => {
                                    Haptics.selectionAsync();
                                    pickTime(23, 59);
                                }}
                                style={pill(dueEndOfDay)}
                                accessibilityRole="button">
                                <ThemedText type="lightBody" style={ink(dueEndOfDay)}>
                                    End of day
                                </ThemedText>
                            </TouchableOpacity>
                        )}
                        {PARTS.map((p) => {
                            const selected = !!value && timed && value.getHours() === p.h && value.getMinutes() === p.m;
                            return (
                                <TouchableOpacity
                                    key={p.label}
                                    onPress={() => {
                                        Haptics.selectionAsync();
                                        pickTime(p.h, p.m);
                                    }}
                                    style={pill(selected)}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected }}
                                    accessibilityLabel={`${p.label}, ${fmtTime(withTime(now, p.h, p.m))}`}>
                                    <ThemedText type="lightBody" style={ink(selected)}>
                                        {p.label}
                                    </ThemedText>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                    {!inlineWheel && (
                        <TouchableOpacity
                            onPress={() => setAndroidClock(true)}
                            style={[pill(false), styles.exact]}
                            accessibilityRole="button">
                            <ThemedText type="lightBody" style={ink(false)}>
                                Exact time{value && timed ? ` · ${fmtTime(value)}` : ""}
                            </ThemedText>
                        </TouchableOpacity>
                    )}
                    {/* Any minute of the chosen day; turning it sets a time */}
                    {(inlineWheel || androidClock) && (
                        <DateTimePicker
                            value={value && timed ? value : withTime(value ?? now, 9, 0)}
                            mode="time"
                            display="spinner"
                            themeVariant="dark"
                            textColor={STAGE.text}
                            minuteInterval={5}
                            onChange={(event, picked) => {
                                if (!inlineWheel) setAndroidClock(false);
                                if (event.type === "dismissed" || !picked) return;
                                pickTime(picked.getHours(), picked.getMinutes());
                            }}
                            style={styles.wheel}
                        />
                    )}
                </Reanimated.View>
            )}
        </View>
    );
};

export default DatePanel;

const styles = StyleSheet.create({
    container: { gap: 16, alignSelf: "stretch" },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    headerRight: { flexDirection: "row", alignItems: "center", gap: 16 },
    segment: { flexDirection: "row", borderRadius: 100, padding: 4, gap: 4 },
    segmentOption: { paddingHorizontal: 16, paddingVertical: 4, borderRadius: 100 },
    parts: { flexDirection: "row", gap: 8 },
    part: { flex: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
    wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    pill: { height: 36, paddingHorizontal: 12, borderRadius: 100, justifyContent: "center" },
    monthHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    round: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
    week: { flexDirection: "row", alignSelf: "stretch" },
    cell: { flex: 1, height: 40, alignItems: "center", justifyContent: "center" },
    weekday: { textAlign: "center", height: 24 },
    day: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
    wheel: { alignSelf: "stretch", height: 180 },
    exact: { alignSelf: "flex-start" },
});

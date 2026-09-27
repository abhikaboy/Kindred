import React, { useState } from "react";
import { Platform, StyleSheet, TouchableOpacity, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Bell, X } from "phosphor-react-native";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/ThemedText";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { SectionTitle } from "@/components/dashboard/SectionHeader";
import { STAGE } from "@/components/capture/CaptureStage";
import { useTaskCreation } from "@/contexts/taskCreationContext";
import type { Reminder } from "@/hooks/useReminder";
import { combineDateAndTime } from "@/utils/timeUtils";

type Anchor = "start" | "due";
type Relative = { key: string; label: string; anchor: Anchor; minutes: number };

// Offsets people use; negative is before, 0 is at the moment itself
const RELATIVE: Relative[] = [
    { key: "start0", label: "At start", anchor: "start", minutes: 0 },
    { key: "start-15", label: "15 min before start", anchor: "start", minutes: -15 },
    { key: "start-60", label: "1 hour before start", anchor: "start", minutes: -60 },
    { key: "due-60", label: "1 hour before due", anchor: "due", minutes: -60 },
    { key: "due-1440", label: "1 day before due", anchor: "due", minutes: -1440 },
];

const fmtTime = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
const fmtWhen = (d: Date, now: Date) => {
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const day = sameDay(d, now)
        ? "Today"
        : sameDay(d, tomorrow)
          ? "Tomorrow"
          : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    return `${day}, ${fmtTime(d)}`;
};
const at = (base: Date, days: number, h: number, m = 0) => {
    const d = new Date(base);
    d.setDate(d.getDate() + days);
    d.setHours(h, m, 0, 0);
    return d;
};
const plusMinutes = (d: Date, minutes: number) => new Date(d.getTime() + minutes * 60 * 1000);

// Same shapes the old screen and the smart reminders produce
const absolute = (triggerTime: Date): Reminder => ({
    triggerTime,
    type: "ABSOLUTE",
    sent: false,
    afterStart: false,
    beforeStart: false,
    beforeDeadline: false,
    afterDeadline: false,
    vibration: true,
});
const relative = (triggerTime: Date, r: Relative): Reminder =>
    r.minutes === 0
        ? absolute(triggerTime)
        : {
              triggerTime,
              type: "RELATIVE",
              sent: false,
              afterStart: false,
              beforeStart: r.anchor === "start",
              beforeDeadline: r.anchor === "due",
              afterDeadline: false,
              vibration: true,
          };

const describeOffset = (minutes: number) => {
    const [n, unit] =
        minutes % 1440 === 0 ? [minutes / 1440, "day"] : minutes % 60 === 0 ? [minutes / 60, "hour"] : [minutes, "min"];
    return `${n} ${unit}${n > 1 && unit !== "min" ? "s" : ""}`;
};

/**
 * Reminders on the stage: the ones already on the task, then one-tap reminders
 * tied to its start or due time, then clock times, with an exact day and time
 * for anything else. Pills toggle: tapping one that's already set removes it.
 * Past times aren't offered.
 */
const ReminderPanel = ({ onDone }: { onDone: () => void }) => {
    const { startDate, startTime, deadline, reminders, setReminders } = useTaskCreation();
    const now = new Date();
    const [custom, setCustom] = useState(false);
    const [customDay, setCustomDay] = useState(0);
    const [customAt, setCustomAt] = useState(() => at(now, 0, now.getHours() + 1));
    const [androidClock, setAndroidClock] = useState(false);

    // Relative reminders need a real clock time to count from
    const startAt = startDate && startTime ? combineDateAndTime(startDate, startTime) : null;
    const anchorOf = (a: Anchor) => (a === "start" ? startAt : deadline);

    const has = (t: Date) => reminders.some((r) => r.triggerTime.getTime() === t.getTime());
    const toggle = (t: Date, make: () => Reminder) => {
        Haptics.selectionAsync();
        if (has(t)) setReminders(reminders.filter((r) => r.triggerTime.getTime() !== t.getTime()));
        else setReminders([...reminders, make()].sort((a, b) => a.triggerTime.getTime() - b.triggerTime.getTime()));
    };

    const describe = (r: Reminder) => {
        const t = r.triggerTime;
        if (r.beforeStart && startAt)
            return `${describeOffset(Math.round((startAt.getTime() - t.getTime()) / 60000))} before start`;
        if (r.beforeDeadline && deadline)
            return `${describeOffset(Math.round((deadline.getTime() - t.getTime()) / 60000))} before due`;
        if (startAt && t.getTime() === startAt.getTime()) return "At start";
        return fmtWhen(t, now);
    };

    const relativeOptions = RELATIVE.flatMap((r) => {
        const base = anchorOf(r.anchor);
        if (!base) return [];
        const t = plusMinutes(base, r.minutes);
        return t > now ? [{ ...r, at: t }] : [];
    });

    const clockOptions = [
        { key: "15m", label: "In 15 min", at: plusMinutes(now, 15) },
        { key: "1h", label: "In 1 hour", at: plusMinutes(now, 60) },
        { key: "3h", label: "In 3 hours", at: plusMinutes(now, 180) },
        ...(now.getHours() < 20 ? [{ key: "tonight", label: "Tonight", at: at(now, 0, 20) }] : []),
        { key: "morning", label: "Tomorrow morning", at: at(now, 1, 9) },
    ].map((o) => ({ ...o, at: new Date(Math.round(o.at.getTime() / 60000) * 60000) }));

    const pill = (selected: boolean) => [styles.pill, { backgroundColor: selected ? STAGE.selected : STAGE.fill }];
    const ink = (selected: boolean) => ({ color: selected ? STAGE.onSelected : STAGE.text });

    const customDays = Array.from({ length: 7 }, (_, i) => at(now, i, 0));
    const customTrigger = at(now, customDay, customAt.getHours(), customAt.getMinutes());

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <SectionTitle title="Reminders" style={{ color: STAGE.text }} />
                <TouchableOpacity onPress={onDone} hitSlop={8} accessibilityRole="button">
                    <ThemedText type="defaultSemiBold" style={{ color: STAGE.text }}>
                        Done
                    </ThemedText>
                </TouchableOpacity>
            </View>

            {reminders.length === 0 ? (
                <ThemedText type="caption" style={{ color: STAGE.muted, marginTop: -8 }}>
                    No reminders yet. Pick one below.
                </ThemedText>
            ) : (
                <View style={styles.list}>
                    {reminders.map((r) => (
                        <View key={r.triggerTime.getTime()} style={[styles.row, { backgroundColor: STAGE.fill }]}>
                            <Bell size={16} color={STAGE.text} weight="fill" />
                            <View style={styles.rowText}>
                                <ThemedText type="default" numberOfLines={1} style={{ color: STAGE.text }}>
                                    {describe(r)}
                                </ThemedText>
                                {(r.beforeStart || r.beforeDeadline || describe(r) === "At start") && (
                                    <ThemedText type="caption" style={{ color: STAGE.muted }}>
                                        {fmtWhen(r.triggerTime, now)}
                                    </ThemedText>
                                )}
                            </View>
                            <TouchableOpacity
                                onPress={() => {
                                    Haptics.selectionAsync();
                                    setReminders(reminders.filter((x) => x !== r));
                                }}
                                hitSlop={8}
                                accessibilityRole="button"
                                accessibilityLabel={`Remove reminder ${describe(r)}`}>
                                <X size={14} color={STAGE.muted} weight="bold" />
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>
            )}

            {relativeOptions.length > 0 && (
                <>
                    <SectionTitle title="Relative to the task" style={{ color: STAGE.text }} />
                    <View style={styles.wrap}>
                        {relativeOptions.map((o) => (
                            <TouchableOpacity
                                key={o.key}
                                onPress={() => toggle(o.at, () => relative(o.at, o))}
                                style={pill(has(o.at))}
                                accessibilityRole="button"
                                accessibilityState={{ selected: has(o.at) }}
                                accessibilityLabel={`${o.label}, ${fmtWhen(o.at, now)}`}>
                                <ThemedText type="lightBody" style={ink(has(o.at))}>
                                    {o.label}
                                </ThemedText>
                            </TouchableOpacity>
                        ))}
                    </View>
                </>
            )}

            <SectionTitle title="At a time" style={{ color: STAGE.text }} />
            <View style={styles.wrap}>
                {clockOptions.map((o) => (
                    <TouchableOpacity
                        key={o.key}
                        onPress={() => toggle(o.at, () => absolute(o.at))}
                        style={pill(has(o.at))}
                        accessibilityRole="button"
                        accessibilityState={{ selected: has(o.at) }}
                        accessibilityLabel={`${o.label}, ${fmtWhen(o.at, now)}`}>
                        <ThemedText type="lightBody" style={ink(has(o.at))}>
                            {o.label}
                        </ThemedText>
                    </TouchableOpacity>
                ))}
                <TouchableOpacity onPress={() => setCustom((c) => !c)} style={pill(custom)} accessibilityRole="button">
                    <ThemedText type="lightBody" style={ink(custom)}>
                        Pick a time
                    </ThemedText>
                </TouchableOpacity>
            </View>

            {custom && (
                <View style={styles.custom}>
                    {/* Day, then the time within it */}
                    <View style={styles.wrap}>
                        {customDays.map((d, i) => (
                            <TouchableOpacity
                                key={i}
                                onPress={() => {
                                    Haptics.selectionAsync();
                                    setCustomDay(i);
                                }}
                                style={pill(customDay === i)}
                                accessibilityRole="button"
                                accessibilityState={{ selected: customDay === i }}>
                                <ThemedText type="lightBody" style={ink(customDay === i)}>
                                    {i === 0
                                        ? "Today"
                                        : i === 1
                                          ? "Tomorrow"
                                          : d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}
                                </ThemedText>
                            </TouchableOpacity>
                        ))}
                    </View>
                    {Platform.OS === "ios" ? (
                        <DateTimePicker
                            value={customAt}
                            mode="time"
                            display="spinner"
                            themeVariant="dark"
                            textColor={STAGE.text}
                            minuteInterval={5}
                            onChange={(_, picked) => picked && setCustomAt(picked)}
                            style={styles.wheel}
                        />
                    ) : (
                        <>
                            <TouchableOpacity
                                onPress={() => setAndroidClock(true)}
                                style={[pill(false), styles.start]}
                                accessibilityRole="button">
                                <ThemedText type="lightBody" style={ink(false)}>
                                    Time · {fmtTime(customAt)}
                                </ThemedText>
                            </TouchableOpacity>
                            {androidClock && (
                                <DateTimePicker
                                    value={customAt}
                                    mode="time"
                                    minuteInterval={5}
                                    onChange={(event, picked) => {
                                        setAndroidClock(false);
                                        if (event.type !== "dismissed" && picked) setCustomAt(picked);
                                    }}
                                />
                            )}
                        </>
                    )}
                    <PrimaryButton
                        title={
                            customTrigger <= now ? "That time has passed" : `Remind me ${fmtWhen(customTrigger, now)}`
                        }
                        disabled={customTrigger <= now || has(customTrigger)}
                        onPress={() => {
                            toggle(customTrigger, () => absolute(customTrigger));
                            setCustom(false);
                        }}
                    />
                </View>
            )}
        </View>
    );
};

export default ReminderPanel;

const styles = StyleSheet.create({
    container: { gap: 16 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    list: { gap: 8 },
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 12,
    },
    rowText: { flex: 1 },
    wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    pill: { height: 36, paddingHorizontal: 12, borderRadius: 100, justifyContent: "center" },
    custom: { gap: 12 },
    wheel: { alignSelf: "stretch", height: 180 },
    start: { alignSelf: "flex-start" },
});

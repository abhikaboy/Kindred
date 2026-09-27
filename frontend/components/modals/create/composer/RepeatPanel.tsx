import React, { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Minus, Plus } from "phosphor-react-native";
import * as Haptics from "expo-haptics";
import { describeSchedule } from "@shared/taskSuggest";
import { ThemedText } from "@/components/ThemedText";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { SectionTitle } from "@/components/dashboard/SectionHeader";
import { STAGE } from "@/components/capture/CaptureStage";
import { useTaskCreation } from "@/contexts/taskCreationContext";

type Unit = "day" | "week" | "month" | "year";
type FlexPeriod = "daily" | "weekly" | "monthly";

const FREQUENCY: Record<Unit, string> = { day: "daily", week: "weekly", month: "monthly", year: "yearly" };
const UNIT_OF: Record<string, Unit> = { daily: "day", weekly: "week", monthly: "month", yearly: "year" };
const UNIT_LABEL: Record<Unit, string> = { day: "Day", week: "Week", month: "Month", year: "Year" };
// Same ceilings the old picker had
const MAX_EVERY: Record<Unit, number> = { day: 365, week: 52, month: 12, year: 10 };
const FLEX_LABEL: Record<FlexPeriod, string> = { daily: "Day", weekly: "Week", monthly: "Month" };
const DAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const NO_DAYS = [0, 0, 0, 0, 0, 0, 0];

const ordinal = (n: number) => {
    const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th";
    return `${n}${s}`;
};

/**
 * Repeat editor, drawn on the composer's dark stage. Two ways to repeat:
 * - Schedule: every N days/weeks/months/years, on chosen weekdays or a day of the month
 * - Flexible: N times per day/week/month, on whichever days
 * Edits write to the task as they happen; Done just closes.
 */
const RepeatPanel = ({ onDone }: { onDone: () => void }) => {
    const {
        startDate,
        deadline,
        recurring,
        recurFrequency,
        recurDetails,
        flexDetails,
        setRecurring,
        setRecurFrequency,
        setRecurDetails,
        setFlexDetails,
    } = useTaskCreation();

    // Weekly and monthly anchor on the task's own day when it has one
    const anchor = startDate ?? deadline ?? new Date();

    const [mode, setMode] = useState<"schedule" | "flex">(flexDetails ? "flex" : "schedule");
    const [unit, setUnit] = useState<Unit>(recurring && !flexDetails ? (UNIT_OF[recurFrequency] ?? "week") : "week");
    const [every, setEvery] = useState(recurring && !flexDetails ? recurDetails.every || 1 : 1);
    const [days, setDays] = useState<number[]>(
        recurring && !flexDetails && recurDetails.daysOfWeek.some(Boolean)
            ? recurDetails.daysOfWeek
            : NO_DAYS.map((_, i) => (i === anchor.getDay() ? 1 : 0))
    );
    const [monthDay, setMonthDay] = useState(recurDetails.daysOfMonth?.[0] ?? anchor.getDate());
    const [flexTarget, setFlexTarget] = useState(flexDetails?.target ?? 3);
    const [flexPeriod, setFlexPeriod] = useState<FlexPeriod>((flexDetails?.period as FlexPeriod) ?? "weekly");

    const on = recurring || !!flexDetails;

    const applySchedule = (next: { unit?: Unit; every?: number; days?: number[]; monthDay?: number }) => {
        const u = next.unit ?? unit;
        const e = Math.min(next.every ?? every, MAX_EVERY[u]);
        const d = next.days ?? days;
        const m = next.monthDay ?? monthDay;
        setUnit(u);
        setEvery(e);
        setDays(d);
        setMonthDay(m);
        setFlexDetails(null);
        setRecurring(true);
        setRecurFrequency(FREQUENCY[u]);
        setRecurDetails({
            every: e,
            daysOfWeek: u === "week" ? d : [...NO_DAYS],
            daysOfMonth: u === "month" ? [m] : undefined,
            behavior: recurDetails.behavior || "ROLLING",
        });
    };

    const applyFlex = (next: { target?: number; period?: FlexPeriod }) => {
        const t = next.target ?? flexTarget;
        const p = next.period ?? flexPeriod;
        setFlexTarget(t);
        setFlexPeriod(p);
        setRecurring(true);
        setRecurFrequency(p);
        setRecurDetails({ every: 1, daysOfWeek: [...NO_DAYS], behavior: "ROLLING" });
        setFlexDetails({ target: t, period: p });
    };

    const turnOff = () => {
        Haptics.selectionAsync();
        setRecurring(false);
        setFlexDetails(null);
    };

    const switchMode = (next: "schedule" | "flex") => {
        Haptics.selectionAsync();
        setMode(next);
        if (next === "flex") applyFlex({});
        else applySchedule({});
    };

    const toggleDay = (i: number) => {
        const next = days.map((v, j) => (j === i ? (v ? 0 : 1) : v));
        // A weekly repeat needs at least one day
        if (!next.some(Boolean)) return;
        Haptics.selectionAsync();
        applySchedule({ days: next });
    };

    const summary = !on
        ? "Doesn't repeat"
        : flexDetails
          ? `${flexDetails.target} ${flexDetails.target === 1 ? "time" : "times"} a ${FLEX_LABEL[flexDetails.period as FlexPeriod]?.toLowerCase() ?? "week"}, on any days`
          : recurFrequency === "monthly" && recurDetails.daysOfMonth?.length
            ? `${recurDetails.every > 1 ? `Every ${recurDetails.every} months` : "Every month"} on the ${ordinal(recurDetails.daysOfMonth[0])}`
            : describeSchedule(null, { recurring: true, recurFrequency, recurDetails } as any);

    const option = (selected: boolean) => [
        styles.option,
        selected
            ? { backgroundColor: STAGE.selected }
            : { backgroundColor: STAGE.fill },
    ];
    const ink = (selected: boolean) => ({ color: selected ? STAGE.onSelected : STAGE.text });

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.fill}>
                    <SectionTitle title="Repeat" style={{ color: STAGE.text }} />
                    <ThemedText type="caption" style={{ color: on ? STAGE.text : STAGE.muted }}>
                        {summary}
                    </ThemedText>
                </View>
                {on && (
                    <TouchableOpacity onPress={turnOff} hitSlop={8} accessibilityRole="button">
                        <ThemedText type="lightBody" style={{ color: STAGE.muted }}>
                            Off
                        </ThemedText>
                    </TouchableOpacity>
                )}
            </View>

            {/* Two kinds of repeat, as a two-way switch */}
            <View style={[styles.switch, { backgroundColor: STAGE.fill }]}>
                {(["schedule", "flex"] as const).map((m) => (
                    <TouchableOpacity
                        key={m}
                        onPress={() => switchMode(m)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: mode === m }}
                        style={[styles.switchOption, mode === m && { backgroundColor: STAGE.selected }]}>
                        <ThemedText type="lightBody" style={{ color: mode === m ? STAGE.onSelected : STAGE.muted }}>
                            {m === "schedule" ? "On a schedule" : "Flexible"}
                        </ThemedText>
                    </TouchableOpacity>
                ))}
            </View>

            {mode === "schedule" ? (
                <>
                    <View style={styles.line}>
                        <ThemedText type="lightBody" style={[styles.lineLabel, { color: STAGE.muted }]}>
                            Every
                        </ThemedText>
                        <Stepper
                            value={every}
                            min={1}
                            max={MAX_EVERY[unit]}
                            onChange={(e) => applySchedule({ every: e })}
                        />
                    </View>
                    <View style={styles.units}>
                        {(Object.keys(UNIT_LABEL) as Unit[]).map((u) => (
                            <TouchableOpacity
                                key={u}
                                style={[option(on && !flexDetails && unit === u), styles.fill]}
                                onPress={() => {
                                    Haptics.selectionAsync();
                                    applySchedule({ unit: u });
                                }}
                                accessibilityRole="button"
                                accessibilityState={{ selected: unit === u }}>
                                <ThemedText type="lightBody" style={ink(on && !flexDetails && unit === u)}>
                                    {UNIT_LABEL[u]}
                                    {every > 1 ? "s" : ""}
                                </ThemedText>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {unit === "week" && (
                        <View style={styles.line}>
                            <ThemedText type="lightBody" style={[styles.lineLabel, { color: STAGE.muted }]}>
                                On
                            </ThemedText>
                            <View style={styles.days}>
                                {DAY_INITIALS.map((d, i) => {
                                    const selected = days[i] === 1;
                                    return (
                                        <TouchableOpacity
                                            key={i}
                                            onPress={() => toggleDay(i)}
                                            accessibilityRole="button"
                                            accessibilityLabel={DAY_NAMES[i]}
                                            accessibilityState={{ selected }}
                                            style={[
                                                styles.day,
                                                selected
                                                    ? { backgroundColor: STAGE.selected, borderColor: STAGE.selected }
                                                    : { backgroundColor: STAGE.fill, borderColor: "transparent" },
                                            ]}>
                                            <ThemedText
                                                type="defaultSemiBold"
                                                style={{ color: selected ? STAGE.onSelected : STAGE.muted }}>
                                                {d}
                                            </ThemedText>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                    )}

                    {unit === "month" && (
                        <View style={styles.line}>
                            <ThemedText type="lightBody" style={[styles.lineLabel, { color: STAGE.muted }]}>
                                On the
                            </ThemedText>
                            <Stepper
                                value={monthDay}
                                min={1}
                                max={31}
                                format={ordinal}
                                onChange={(m) => applySchedule({ monthDay: m })}
                            />
                        </View>
                    )}
                </>
            ) : (
                <>
                    <View style={styles.line}>
                        <Stepper
                            value={flexTarget}
                            min={1}
                            max={20}
                            format={(n) => `${n}x`}
                            onChange={(t) => applyFlex({ target: t })}
                        />
                        <ThemedText type="lightBody" style={{ color: STAGE.muted }}>
                            per
                        </ThemedText>
                    </View>
                    <View style={styles.units}>
                        {(Object.keys(FLEX_LABEL) as FlexPeriod[]).map((p) => (
                            <TouchableOpacity
                                key={p}
                                style={[option(!!flexDetails && flexPeriod === p), styles.fill]}
                                onPress={() => {
                                    Haptics.selectionAsync();
                                    applyFlex({ period: p });
                                }}
                                accessibilityRole="button"
                                accessibilityState={{ selected: flexPeriod === p }}>
                                <ThemedText type="lightBody" style={ink(!!flexDetails && flexPeriod === p)}>
                                    {FLEX_LABEL[p]}
                                </ThemedText>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <ThemedText type="caption" style={{ color: STAGE.muted }}>
                        Good for habits like the gym: it counts toward the goal whichever days you do it.
                    </ThemedText>
                </>
            )}

            <PrimaryButton title="Done" onPress={onDone} />
        </View>
    );
};

export default RepeatPanel;

const Stepper = ({
    value,
    min,
    max,
    onChange,
    format = String,
}: {
    value: number;
    min: number;
    max: number;
    onChange: (value: number) => void;
    format?: (n: number) => string;
}) => {
    const step = (delta: number) => {
        const next = Math.max(min, Math.min(max, value + delta));
        if (next === value) return;
        Haptics.selectionAsync();
        onChange(next);
    };
    const button = (disabled: boolean) => [
        styles.stepButton,
        { backgroundColor: STAGE.fill, opacity: disabled ? 0.4 : 1 },
    ];
    return (
        <View style={styles.stepper}>
            <TouchableOpacity
                onPress={() => step(-1)}
                disabled={value <= min}
                style={button(value <= min)}
                accessibilityRole="button"
                accessibilityLabel="Fewer">
                <Minus size={16} color={STAGE.text} weight="bold" />
            </TouchableOpacity>
            <ThemedText type="defaultSemiBold" style={[styles.stepValue, { color: STAGE.text }]}>
                {format(value)}
            </ThemedText>
            <TouchableOpacity
                onPress={() => step(1)}
                disabled={value >= max}
                style={button(value >= max)}
                accessibilityRole="button"
                accessibilityLabel="More">
                <Plus size={16} color={STAGE.text} weight="bold" />
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { gap: 16 },
    fill: { flex: 1 },
    header: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
    switch: { flexDirection: "row", borderRadius: 100, padding: 4, gap: 4 },
    switchOption: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 100 },
    line: { flexDirection: "row", alignItems: "center", gap: 12 },
    lineLabel: { width: 52 },
    units: { flexDirection: "row", gap: 8 },
    option: { height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    days: { flex: 1, flexDirection: "row", justifyContent: "space-between" },
    day: {
        width: 36,
        height: 36,
        borderRadius: 36,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    stepper: { flexDirection: "row", alignItems: "center", gap: 12 },
    stepButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
    },
    stepValue: { minWidth: 48, textAlign: "center" },
});

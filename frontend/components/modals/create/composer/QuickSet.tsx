import React, { useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Flag, Sparkle } from "phosphor-react-native";
import * as Haptics from "expo-haptics";
import Reanimated from "react-native-reanimated";
import { parseRecurrence } from "@shared/taskSuggest";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { SectionTitle } from "@/components/dashboard/SectionHeader";
import { ON_DARK, ON_DARK_MUTED, SOFT_ENTER, STAGE } from "@/components/capture/CaptureStage";
import { useTaskCreation } from "@/contexts/taskCreationContext";
import { quickMoments, type Moment } from "./quickMoments";

const PRIORITY_LABEL: Record<number, string> = { 1: "Low", 2: "Medium", 3: "High" };
const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

type Step = "when" | "repeat" | "priority";

const fmtMoment = (d: Date, now: Date) => {
    const sameDay = d.toDateString() === now.toDateString();
    const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return sameDay ? time : `${d.toLocaleDateString(undefined, { weekday: "short" })} ${time}`;
};

type Props = {
    /** Nothing is asked until there's a task to ask about. */
    hasTitle: boolean;
    /** The model's guess for this title, when it differs from the current priority. */
    suggestedPriority?: number;
    onPriority: (priority: number) => void;
    /** Setting a date or repeat by tap takes precedence over the text parse. */
    onScheduleTouched: () => void;
};

/**
 * One question at a time in the space above the title, only once it's
 * relevant: when (until the task has a date), then whether it repeats (once it
 * has one), then a priority the model thinks fits better. Answering or "Not
 * now" moves on; everything stays editable from the chips below.
 */
const QuickSet = ({ hasTitle, suggestedPriority, onPriority, onScheduleTouched }: Props) => {
    const ThemedColor = useThemeColor();
    const {
        startDate,
        setStartDate,
        setStartTime,
        deadline,
        setDeadline,
        recurring,
        flexDetails,
        recurDetails,
        setRecurring,
        setRecurFrequency,
        setRecurDetails,
        setFlexDetails,
    } = useTaskCreation();
    const [target, setTarget] = useState<"start" | "due">("start");
    const [skipped, setSkipped] = useState<Step[]>([]);
    const now = new Date();

    const dated = startDate !== null || deadline !== null;
    const step: Step | null = !hasTitle
        ? null
        : !dated && !skipped.includes("when")
          ? "when"
          : dated && !recurring && !flexDetails && !skipped.includes("repeat")
            ? "repeat"
            : suggestedPriority && !skipped.includes("priority")
              ? "priority"
              : null;

    if (!step) return null;

    const skip = () => {
        Haptics.selectionAsync();
        setSkipped((s) => [...s, step]);
    };

    // Flat white-alpha on the black scrim, the same in both themes
    const tile = (suggested = false) => [
        styles.tile,
        suggested
            ? { backgroundColor: STAGE.fillRaised, borderColor: STAGE.faint, borderStyle: "dashed" as const }
            : { backgroundColor: STAGE.fill },
    ];

    const header = (title: string, extra?: React.ReactNode) => (
        <View style={styles.header}>
            <SectionTitle title={title} style={{ color: ON_DARK }} />
            <View style={styles.headerRight}>
                {extra}
                <TouchableOpacity onPress={skip} hitSlop={8} accessibilityRole="button">
                    <ThemedText type="caption" style={{ color: ON_DARK_MUTED }}>
                        Not now
                    </ThemedText>
                </TouchableOpacity>
            </View>
        </View>
    );

    if (step === "when") {
        const moments = quickMoments(now, target);
        const pick = (m: Moment) => {
            Haptics.selectionAsync();
            onScheduleTouched();
            if (target === "start") {
                setStartDate(m.at);
                setStartTime(m.at);
            } else {
                setDeadline(m.at);
            }
        };
        return (
            <Reanimated.View key={step} entering={SOFT_ENTER} style={styles.container}>
                {header(
                    target === "start" ? "When will you do it?" : "When is it due?",
                    // Which field the tiles fill
                    <View style={[styles.toggle, { backgroundColor: STAGE.fill }]}>
                        {(["start", "due"] as const).map((t) => (
                            <TouchableOpacity
                                key={t}
                                onPress={() => setTarget(t)}
                                accessibilityRole="button"
                                accessibilityState={{ selected: target === t }}
                                style={[styles.toggleOption, target === t && { backgroundColor: STAGE.selected }]}>
                                <ThemedText
                                    type="caption"
                                    style={{ color: target === t ? STAGE.onSelected : STAGE.muted }}>
                                    {t === "start" ? "Start" : "Due"}
                                </ThemedText>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyboardShouldPersistTaps="always"
                    contentContainerStyle={styles.row}>
                    {moments.map((m) => (
                        <TouchableOpacity
                            key={m.key}
                            onPress={() => pick(m)}
                            accessibilityRole="button"
                            accessibilityLabel={`${target === "start" ? "Start" : "Due"} ${m.label}, ${fmtMoment(m.at, now)}`}
                            style={tile()}>
                            <ThemedText type="lightBody" style={{ color: STAGE.text }}>
                                {m.label}
                            </ThemedText>
                            <ThemedText type="caption" style={{ color: STAGE.muted }}>
                                {fmtMoment(m.at, now)}
                            </ThemedText>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </Reanimated.View>
        );
    }

    if (step === "repeat") {
        // Anchored on the day the task now has
        const anchor = startDate ?? deadline ?? now;
        const repeats = [
            { key: "daily", label: "Every day", phrase: "every day" },
            { key: "weekdays", label: "Weekdays", phrase: "weekdays" },
            {
                key: "weekly",
                label: `Every ${anchor.toLocaleDateString(undefined, { weekday: "long" })}`,
                phrase: `every ${DAY_NAMES[anchor.getDay()]}`,
            },
            { key: "monthly", label: `Monthly on the ${anchor.getDate()}`, phrase: "monthly" },
        ];
        const pick = (phrase: string) => {
            const r = parseRecurrence(phrase, anchor);
            if (!r) return;
            Haptics.selectionAsync();
            onScheduleTouched();
            setFlexDetails(null);
            setRecurring(true);
            setRecurFrequency(r.recurFrequency);
            setRecurDetails({ ...recurDetails, ...r.recurDetails });
        };
        return (
            <Reanimated.View key={step} entering={SOFT_ENTER} style={styles.container}>
                {header("Does it repeat?")}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyboardShouldPersistTaps="always"
                    contentContainerStyle={styles.row}>
                    {repeats.map((r) => (
                        <TouchableOpacity
                            key={r.key}
                            onPress={() => pick(r.phrase)}
                            accessibilityRole="button"
                            style={[tile(), styles.chip]}>
                            <ThemedText type="lightBody" style={{ color: STAGE.text }}>
                                {r.label}
                            </ThemedText>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </Reanimated.View>
        );
    }

    // A single suggestion, not the whole scale: the chip below has the rest
    const color = suggestedPriority! >= 3 ? ThemedColor.error : ThemedColor.warning;
    return (
        <Reanimated.View key={step} entering={SOFT_ENTER} style={styles.container}>
            {header("Sounds important")}
            <TouchableOpacity
                onPress={() => {
                    Haptics.selectionAsync();
                    onPriority(suggestedPriority!);
                }}
                accessibilityRole="button"
                style={[tile(true), styles.chip, styles.suggestion]}>
                <Flag size={16} color={color} weight="fill" />
                <ThemedText type="lightBody" style={{ color: STAGE.text }}>
                    Make it {PRIORITY_LABEL[suggestedPriority!]} priority
                </ThemedText>
                <Sparkle size={12} color={ThemedColor.primary} weight="fill" />
            </TouchableOpacity>
        </Reanimated.View>
    );
};

export default QuickSet;

const styles = StyleSheet.create({
    container: { gap: 12 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
    headerRight: { flexDirection: "row", alignItems: "center", gap: 12 },
    // Segmented pill: the chosen side is solid white
    toggle: { flexDirection: "row", borderRadius: 100, padding: 2, gap: 2 },
    toggleOption: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 100 },
    row: { flexDirection: "row", gap: 8 },
    tile: { borderRadius: 12, borderWidth: 1, borderColor: "transparent", paddingHorizontal: 12, paddingVertical: 8 },
    chip: { flexDirection: "row", alignItems: "center", gap: 8, height: 44, paddingVertical: 0 },
    suggestion: { alignSelf: "flex-start" },
});

import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { CalendarBlank, CaretLeft, CaretRight, Clock, ListBullets } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";

export type PlannerView = "day" | "week" | "month";

const VIEW_LABELS: Record<PlannerView, string> = { day: "Day", week: "Week", month: "Month" };
const VIEWS = Object.keys(VIEW_LABELS) as PlannerView[];

const VIEW_ICONS = {
    Day: (color: string) => <Clock size={16} color={color} weight="bold" />,
    Week: (color: string) => <ListBullets size={16} color={color} weight="bold" />,
    Month: (color: string) => <CalendarBlank size={16} color={color} weight="bold" />,
};

type Props = {
    /** "September 27", "September 21 – 27", "September"; the year is appended when it isn't this year. */
    title: string;
    year: number;
    view: PlannerView;
    onViewChange: (view: PlannerView) => void;
    onStep: (delta: 1 | -1) => void;
    /** Shown only when today is off screen. */
    onToday?: () => void;
    onBack?: () => void;
};

const PlannerHeader = ({ title, year, view, onViewChange, onStep, onToday, onBack }: Props) => {
    const ThemedColor = useThemeColor();
    const stepLabel = view;

    return (
        <View style={styles.wrap}>
            <View style={styles.row}>
                {onBack && (
                    <TouchableOpacity
                        onPress={onBack}
                        style={[styles.backButton, { backgroundColor: ThemedColor.lightened }]}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Go back"
                    >
                        <CaretLeft size={20} color={ThemedColor.text} weight="bold" />
                    </TouchableOpacity>
                )}
                <View style={styles.title}>
                    <ThemedText
                        type="fancyFrauncesSubheading"
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.8}
                        style={{ flexShrink: 1 }}
                    >
                        {title}
                    </ThemedText>
                    {year !== new Date().getFullYear() && (
                        <ThemedText type="subtitle_subtle">{year}</ThemedText>
                    )}
                </View>
                {onToday && (
                    <TouchableOpacity
                        onPress={onToday}
                        style={[styles.todayButton, { borderColor: ThemedColor.tertiary }]}
                        hitSlop={6}
                        accessibilityRole="button"
                    >
                        <ThemedText type="caption" style={{ color: ThemedColor.primary }}>
                            Today
                        </ThemedText>
                    </TouchableOpacity>
                )}
                <TouchableOpacity
                    onPress={() => onStep(-1)}
                    hitSlop={8}
                    style={[styles.stepButton, { backgroundColor: ThemedColor.lightened }]}
                    accessibilityLabel={`Previous ${stepLabel}`}
                >
                    <CaretLeft size={16} color={ThemedColor.text} weight="bold" />
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => onStep(1)}
                    hitSlop={8}
                    style={[styles.stepButton, { backgroundColor: ThemedColor.lightened }]}
                    accessibilityLabel={`Next ${stepLabel}`}
                >
                    <CaretRight size={16} color={ThemedColor.text} weight="bold" />
                </TouchableOpacity>
            </View>
            <SegmentedControl
                options={VIEWS.map((v) => VIEW_LABELS[v])}
                selectedOption={VIEW_LABELS[view]}
                onOptionPress={(label) => onViewChange(VIEWS.find((v) => VIEW_LABELS[v] === label) ?? "week")}
                icons={VIEW_ICONS}
                size="small"
                accent
                compact
            />
        </View>
    );
};

const styles = StyleSheet.create({
    wrap: {
        paddingHorizontal: HORIZONTAL_PADDING,
        paddingTop: 4,
        paddingBottom: 4,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 8,
    },
    title: {
        flex: 1,
        flexDirection: "row",
        alignItems: "baseline",
        gap: 8,
    },
    todayButton: {
        borderWidth: 1,
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 4,
    },
    stepButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
    },
    backButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 4,
    },
});

export default PlannerHeader;

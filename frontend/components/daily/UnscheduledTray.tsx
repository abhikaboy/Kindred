import React, { useState } from "react";
import { View, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { CaretDown, CaretUp, DotsSixVertical } from "phosphor-react-native";
import HintBubble from "@/components/ui/HintBubble";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HORIZONTAL_PADDING } from "@/constants/spacing";

type Props = {
    tasks: any[];
    hiddenIds: Set<string>;
    onDragStart: (task: any) => void;
    onDragMove: (x: number, y: number) => void;
    onDragEnd: (task: any, x: number, y: number) => void;
    onPressChip: (task: any) => void;
    hintVisible: boolean;
    onHintDone: () => void;
};

type ChipProps = Omit<Props, "tasks" | "hiddenIds" | "hintVisible" | "onHintDone"> & { task: any };

const Chip = ({ task, onDragStart, onDragMove, onDragEnd, onPressChip }: ChipProps) => {
    const ThemedColor = useThemeColor();
    const pan = Gesture.Pan()
        .activateAfterLongPress(300)
        .onStart(() => runOnJS(onDragStart)(task))
        .onUpdate((e) => runOnJS(onDragMove)(e.absoluteX, e.absoluteY))
        .onEnd((e) => runOnJS(onDragEnd)(task, e.absoluteX, e.absoluteY))
        // Cancelled mid-drag: end off every target so the preview and highlight clear
        .onFinalize((_e, success) => {
            if (!success) runOnJS(onDragEnd)(task, -1, -1);
        });
    const tap = Gesture.Tap().onEnd(() => runOnJS(onPressChip)(task));

    return (
        <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
            <View style={[styles.chip, { borderColor: ThemedColor.tertiary, backgroundColor: ThemedColor.lightenedCard }]}>
                <ThemedText type="smallerDefault" numberOfLines={1} style={{ flexShrink: 1 }}>
                    {task.content}
                </ThemedText>
                <DotsSixVertical size={14} color={ThemedColor.caption} weight="bold" />
            </View>
        </GestureDetector>
    );
};

const UnscheduledTray = ({ tasks, hiddenIds, onDragStart, onDragMove, onDragEnd, onPressChip, hintVisible, onHintDone }: Props) => {
    const ThemedColor = useThemeColor();
    // Collapsed to one line by default; first-timers see it open with the hint
    const [expanded, setExpanded] = useState(hintVisible);
    const visible = tasks.filter((t) => !hiddenIds.has(t.id));
    if (visible.length === 0) return null;

    const Caret = expanded ? CaretDown : CaretUp;

    return (
        <View style={[styles.tray, { backgroundColor: ThemedColor.lightened, borderColor: ThemedColor.tertiary }]}>
            <TouchableOpacity
                onPress={() => setExpanded((e) => !e)}
                style={styles.header}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={expanded ? "Hide unscheduled tasks" : "Show unscheduled tasks"}
            >
                <ThemedText type="defaultSemiBold">Unscheduled</ThemedText>
                <View style={[styles.count, { backgroundColor: ThemedColor.primary + "1F" }]}>
                    <ThemedText type="caption" style={{ color: ThemedColor.primary }}>
                        {visible.length}
                    </ThemedText>
                </View>
                <View style={{ flex: 1 }} />
                <Caret size={16} color={ThemedColor.caption} weight="bold" />
            </TouchableOpacity>
            {expanded && hintVisible && (
                <HintBubble text="Hold a task, then drag it onto a day" onDone={onHintDone} autoDismissMs={8000} />
            )}
            {expanded && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                    {visible.map((t) => (
                        <Chip
                            key={t.id}
                            task={t}
                            onDragStart={onDragStart}
                            onDragMove={onDragMove}
                            onDragEnd={onDragEnd}
                            onPressChip={onPressChip}
                        />
                    ))}
                </ScrollView>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    tray: {
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 20,
        marginHorizontal: HORIZONTAL_PADDING / 2,
        marginBottom: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.16,
        shadowRadius: 12,
        elevation: 6,
        paddingHorizontal: 12,
        paddingVertical: 12,
        gap: 8,
    },
    header: { flexDirection: "row", alignItems: "center", gap: 8 },
    count: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 0 },
    chips: { gap: 8, paddingRight: 12 },
    chip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        borderWidth: 1,
        borderRadius: 16,
        paddingLeft: 12,
        paddingRight: 8,
        paddingVertical: 8,
        maxWidth: 200,
    },
});

export default UnscheduledTray;

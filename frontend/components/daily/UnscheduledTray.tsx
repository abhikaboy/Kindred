import React from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
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
};

type ChipProps = Omit<Props, "tasks" | "hiddenIds" | "hintVisible"> & { task: any };

const Chip = ({ task, onDragStart, onDragMove, onDragEnd, onPressChip }: ChipProps) => {
    const ThemedColor = useThemeColor();
    const pan = Gesture.Pan()
        .activateAfterLongPress(300)
        .onStart(() => runOnJS(onDragStart)(task))
        .onUpdate((e) => runOnJS(onDragMove)(e.absoluteX, e.absoluteY))
        .onEnd((e) => runOnJS(onDragEnd)(task, e.absoluteX, e.absoluteY));
    const tap = Gesture.Tap().onEnd(() => runOnJS(onPressChip)(task));

    return (
        <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
            <View style={[styles.chip, { borderColor: ThemedColor.tertiary, backgroundColor: ThemedColor.background }]}>
                <ThemedText type="smallerDefault" numberOfLines={1}>
                    {task.content}
                </ThemedText>
            </View>
        </GestureDetector>
    );
};

const UnscheduledTray = ({ tasks, hiddenIds, onDragStart, onDragMove, onDragEnd, onPressChip, hintVisible }: Props) => {
    const ThemedColor = useThemeColor();
    const visible = tasks.filter((t) => !hiddenIds.has(t.id));
    if (visible.length === 0) return null;

    return (
        <View style={[styles.tray, { backgroundColor: ThemedColor.lightened, borderTopColor: ThemedColor.tertiary }]}>
            <ThemedText type="caption" style={{ color: ThemedColor.primary }}>
                UNSCHEDULED · {visible.length}
            </ThemedText>
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
            {hintVisible && (
                <ThemedText type="caption" style={{ color: ThemedColor.caption }}>
                    Hold and drag a task onto a day to schedule it
                </ThemedText>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    tray: {
        borderTopWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: HORIZONTAL_PADDING,
        paddingTop: 10,
        paddingBottom: 14,
        gap: 8,
    },
    chips: { gap: 8, paddingRight: 24 },
    chip: {
        borderWidth: 1,
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 7,
        maxWidth: 180,
    },
});

export default UnscheduledTray;

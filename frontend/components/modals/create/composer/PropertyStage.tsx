import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import Reanimated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "phosphor-react-native";
import { CaptureBackdrop, SOFT_ENTER, STAGE } from "@/components/capture/CaptureStage";
import { TaskCreationProvider, useTaskCreationActions } from "@/contexts/taskCreationContext";

const FADE = { duration: 220, easing: Easing.out(Easing.cubic) };

type Props = {
    visible: boolean;
    setVisible: (visible: boolean) => void;
    /** Seeds the stage's own draft; the global create draft is never touched. */
    task: any;
    /** Rendered once seeded; call `close` to fade the stage out. */
    children: (close: () => void) => React.ReactNode;
};

// Loads the task into the nearest (scoped) provider before the panel mounts
const Seeded = ({ task, children }: { task: any; children: React.ReactNode }) => {
    const { loadTaskData } = useTaskCreationActions();
    const [ready, setReady] = useState(false);
    useLayoutEffect(() => {
        loadTaskData(task ?? {});
        setReady(true);
        // Seed once per open; later task edits must not clobber the draft
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return ready ? <>{children}</> : null;
};

/**
 * One composer panel on the black scrim, editing a single property of an
 * existing task. Hosts DeadlineStage and ReminderStage.
 */
const PropertyStage = ({ visible, setVisible, task, children }: Props) => {
    const insets = useSafeAreaInsets();
    const opacity = useSharedValue(0);
    const closingRef = useRef(false);
    const contentStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

    useEffect(() => {
        if (visible) {
            closingRef.current = false;
            opacity.value = withTiming(1, FADE);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);

    const finishClose = () => setVisible(false);
    const close = () => {
        if (closingRef.current) return;
        closingRef.current = true;
        opacity.value = withTiming(0, FADE, () => runOnJS(finishClose)());
    };

    if (!visible) return null;

    return (
        <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={close}>
            <CaptureBackdrop opacity={opacity} />
            <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" />
            <Reanimated.View style={[styles.fill, contentStyle]} pointerEvents="box-none">
                <View style={[styles.topBar, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
                    <TouchableOpacity
                        onPress={close}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Close without saving"
                        style={[styles.closeButton, { backgroundColor: STAGE.fillRaised }]}>
                        <X size={18} color={STAGE.text} weight="bold" />
                    </TouchableOpacity>
                </View>
                <View style={styles.fill} pointerEvents="box-none" />
                <ScrollView
                    style={styles.panel}
                    contentContainerStyle={[styles.panelContent, { paddingBottom: insets.bottom + 24 }]}
                    keyboardShouldPersistTaps="always"
                    showsVerticalScrollIndicator={false}>
                    <Reanimated.View entering={SOFT_ENTER}>
                        <TaskCreationProvider>
                            <Seeded task={task}>{children(close)}</Seeded>
                        </TaskCreationProvider>
                    </Reanimated.View>
                </ScrollView>
            </Reanimated.View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    fill: { flex: 1 },
    topBar: { paddingHorizontal: 16, alignItems: "flex-start" },
    closeButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
    panel: { flexGrow: 0, flexShrink: 1 },
    panelContent: { paddingHorizontal: 16, paddingTop: 24 },
});

export default PropertyStage;

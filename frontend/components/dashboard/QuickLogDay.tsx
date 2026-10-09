import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MoonStarsIcon } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useTasksSelector } from "@/contexts/tasksContext";
import { isEndOfDayWindow, quickLogDoneKey, todaysOpenTasks } from "@/utils/endOfDay";
import { hapticLight } from "@/utils/haptics";
import EndOfDayReviewSheet from "@/components/modals/EndOfDayReviewSheet";

/**
 * Shown only in the evening window and until today's log succeeds. Starts hidden
 * until storage answers so it never flashes; re-checks every minute so it appears
 * at 8pm and returns after midnight.
 */
function useQuickLogVisible() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const check = async () => {
            const now = new Date();
            const stored = await AsyncStorage.getItem(quickLogDoneKey(now)).catch(() => null);
            if (!cancelled) setVisible(isEndOfDayWindow(now) && stored == null);
        };
        check();
        const interval = setInterval(check, 60_000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, []);

    const markDone = useCallback(() => {
        setVisible(false);
        AsyncStorage.setItem(quickLogDoneKey(new Date()), "1").catch(() => {});
    }, []);

    return { visible, markDone };
}

/** Home chip for the end-of-day review: check off today's tasks and log untracked ones. */
export default function QuickLogDay() {
    const ThemedColor = useThemeColor();
    const allTasks = useTasksSelector((s) => s.allTasks);
    const [sheetVisible, setSheetVisible] = useState(false);
    const { visible, markDone } = useQuickLogVisible();

    const openTasks = useMemo(() => todaysOpenTasks(allTasks), [allTasks]);

    return (
        <>
            {visible && (
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => {
                        hapticLight();
                        setSheetVisible(true);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Log my day"
                    style={[styles.chip, { backgroundColor: ThemedColor.primary + "26" }]}>
                    <MoonStarsIcon size={16} weight="fill" color={ThemedColor.primary} />
                    <ThemedText type="smallerDefault" style={{ color: ThemedColor.primary }}>
                        Log my day
                    </ThemedText>
                </TouchableOpacity>
            )}
            {/* Stays mounted after markDone so the sheet can finish closing */}
            <EndOfDayReviewSheet
                visible={sheetVisible}
                setVisible={setSheetVisible}
                openTasks={openTasks}
                onLogged={markDone}
            />
        </>
    );
}

const styles = StyleSheet.create({
    chip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 100,
    },
});

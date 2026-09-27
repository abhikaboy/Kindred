import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CaretRightIcon, MoonStarsIcon } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useTasksSelector } from "@/contexts/tasksContext";
import { quickLogDoneKey, todaysOpenTasks } from "@/utils/endOfDay";
import { hapticLight } from "@/utils/haptics";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import EndOfDayReviewSheet from "@/components/modals/EndOfDayReviewSheet";

const ICON_COLOR = "#FFFFFF";

/**
 * Hidden once today's log succeeded. Starts hidden until storage answers so it
 * never flashes, and re-checks every minute so it returns after midnight.
 */
function useQuickLogDone() {
    const [done, setDone] = useState(true);

    useEffect(() => {
        let cancelled = false;
        const check = async () => {
            const stored = await AsyncStorage.getItem(quickLogDoneKey(new Date())).catch(() => null);
            if (!cancelled) setDone(stored != null);
        };
        check();
        const interval = setInterval(check, 60_000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, []);

    const markDone = useCallback(() => {
        setDone(true);
        AsyncStorage.setItem(quickLogDoneKey(new Date()), "1").catch(() => {});
    }, []);

    return { done, markDone };
}

/** Home entry point for the end-of-day review: check off today's tasks and log untracked ones. */
export default function QuickLogDay() {
    const ThemedColor = useThemeColor();
    const allTasks = useTasksSelector((s) => s.allTasks);
    const [sheetVisible, setSheetVisible] = useState(false);
    const { done, markDone } = useQuickLogDone();

    const openTasks = useMemo(() => todaysOpenTasks(allTasks), [allTasks]);

    const subtitle =
        openTasks.length > 0
            ? `${openTasks.length} open task${openTasks.length === 1 ? "" : "s"} from today to check off`
            : "Add anything you got done today";

    return (
        <>
            {!done && (
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                        hapticLight();
                        setSheetVisible(true);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Quick log my day"
                    style={[styles.row, { backgroundColor: ThemedColor.primary }]}>
                    <View style={styles.iconBadge}>
                        <MoonStarsIcon size={20} weight="fill" color={ICON_COLOR} />
                    </View>
                    <View style={styles.text}>
                        <ThemedText type="defaultSemiBold" style={{ color: ThemedColor.buttonText }}>
                            Quick log my day
                        </ThemedText>
                        <ThemedText type="caption" style={{ color: ThemedColor.buttonText, opacity: 0.8 }}>
                            {subtitle}
                        </ThemedText>
                    </View>
                    <CaretRightIcon size={16} weight="bold" color={ICON_COLOR} />
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
    row: {
        marginHorizontal: HORIZONTAL_PADDING,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 12,
        // Matches PrimaryButton's radius so it reads as the same CTA
        borderRadius: 12,
    },
    iconBadge: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255, 255, 255, 0.15)",
    },
    text: {
        flex: 1,
        gap: 2,
    },
});

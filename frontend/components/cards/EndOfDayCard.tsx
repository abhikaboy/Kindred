import React, { useMemo, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { MoonStarsIcon, XIcon } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useTasks } from "@/contexts/tasksContext";
import { useEndOfDayCard } from "@/hooks/useEndOfDayCard";
import { todaysOpenTasks } from "@/utils/endOfDay";
import EndOfDayReviewSheet from "@/components/modals/EndOfDayReviewSheet";

export default function EndOfDayCard() {
    const { visible, dismiss } = useEndOfDayCard();
    const { allTasks } = useTasks();
    const [sheetVisible, setSheetVisible] = useState(false);
    const ThemedColor = useThemeColor();

    const openTasks = useMemo(() => todaysOpenTasks(allTasks), [allTasks]);

    if (!visible) return null;

    const subtitle =
        openTasks.length > 0
            ? `You have ${openTasks.length} open task${openTasks.length === 1 ? "" : "s"} from today — check off what you finished and add anything else you got done.`
            : "Add anything you got done today, even if you never tracked it.";

    return (
        <View style={[styles.card, { backgroundColor: ThemedColor.lightenedCard, borderColor: ThemedColor.tertiary }]}>
            <View style={styles.headerRow}>
                <MoonStarsIcon size={24} weight="duotone" color={ThemedColor.primary} />
                <TouchableOpacity onPress={dismiss} hitSlop={8}>
                    <XIcon size={20} color={ThemedColor.caption} />
                </TouchableOpacity>
            </View>
            <ThemedText type="fancyFrauncesSubheading">How did today go?</ThemedText>
            <ThemedText type="lightBody" style={{ color: ThemedColor.caption }}>
                {subtitle}
            </ThemedText>
            <PrimaryButton title="Log my day" onPress={() => setSheetVisible(true)} />
            <EndOfDayReviewSheet
                visible={sheetVisible}
                setVisible={setSheetVisible}
                openTasks={openTasks}
                onLogged={dismiss}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        marginHorizontal: 16,
        marginVertical: 16,
        padding: 20,
        borderRadius: 16,
        borderWidth: 1,
        gap: 12,
        alignItems: "flex-start",
    },
    headerRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignSelf: "stretch",
        alignItems: "center",
    },
});

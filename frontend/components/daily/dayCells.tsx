import React from "react";
import { View, StyleSheet, useColorScheme } from "react-native";
import { DayDensity } from "@/utils/taskCountsByDay";
import { getCategoryDuotoneColors } from "@/utils/categoryColors";

export const mondayOf = (d: Date): Date => {
    const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dow = (out.getDay() + 6) % 7; // Mon=0
    out.setDate(out.getDate() - dow);
    return out;
};

export const DayDots = ({ density }: { density?: DayDensity }) => {
    const scheme = useColorScheme() === "dark" ? "dark" : "light";
    if (!density) return <View style={dotStyles.row} />;
    return (
        <View style={dotStyles.row}>
            {density.categoryRefs.map((ref, i) => (
                <View
                    key={i}
                    style={[
                        dotStyles.dot,
                        { backgroundColor: getCategoryDuotoneColors(ref.categoryID, ref.categoryName, scheme).dark },
                    ]}
                />
            ))}
        </View>
    );
};

const dotStyles = StyleSheet.create({
    row: { flexDirection: "row", gap: 3, minHeight: 6, justifyContent: "center" },
    dot: { width: 5, height: 5, borderRadius: 3 },
});

// Day cells register themselves; the planner measures them when a drag starts so
// the rects are right even after the pager, a scroll, or a collapse has moved them.
export type DropTarget = {
    measureInWindow: (cb: (x: number, y: number, width: number, height: number) => void) => void;
};

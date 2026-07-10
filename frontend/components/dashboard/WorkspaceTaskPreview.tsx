import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import SwipableTaskCard from "@/components/cards/SwipableTaskCard";
import { HORIZONTAL_PADDING } from "@/constants/spacing";

const PREVIEW_LIMIT = 3;

interface Props {
    categories: any[];
    onShowAll: () => void;
    ThemedColor: any;
}

/** Up to PREVIEW_LIMIT real task cards under a workspace; overflow renders as a tappable stack. */
const WorkspaceTaskPreview: React.FC<Props> = ({ categories, onShowAll, ThemedColor }) => {
    const entries = (categories ?? [])
        .filter((cat: any) => cat.name !== "!-proxy-!")
        .flatMap((cat: any) =>
            (cat.tasks ?? [])
                .filter((t: any) => !t.isPhantom)
                .map((t: any) => ({ task: t, categoryId: cat.id }))
        );

    if (entries.length === 0) return null;

    const visible = entries.slice(0, PREVIEW_LIMIT);
    const hidden = entries.length - visible.length;

    return (
        <View style={styles.container}>
            {visible.map(({ task, categoryId }) => (
                <SwipableTaskCard key={task.id} redirect categoryId={categoryId} task={task} />
            ))}
            {hidden > 0 && (
                <TouchableOpacity onPress={onShowAll} activeOpacity={0.7} style={styles.stack}>
                    <View
                        style={[
                            styles.stackEdge,
                            { backgroundColor: ThemedColor.lightenedCard, borderColor: ThemedColor.tertiary, width: "94%" },
                        ]}
                    />
                    <View
                        style={[
                            styles.stackEdge,
                            { backgroundColor: ThemedColor.lightenedCard, borderColor: ThemedColor.tertiary, width: "86%", height: 8 },
                        ]}
                    />
                    <ThemedText type="caption" style={{ color: ThemedColor.caption, marginTop: 4 }}>
                        +{hidden} more
                    </ThemedText>
                </TouchableOpacity>
            )}
        </View>
    );
};

export default WorkspaceTaskPreview;

const styles = StyleSheet.create({
    container: {
        gap: 8,
        paddingTop: 4,
        paddingBottom: 12,
        paddingHorizontal: HORIZONTAL_PADDING,
        marginLeft: 16,
    },
    stack: {
        alignItems: "center",
        gap: 3,
        marginTop: -2,
    },
    stackEdge: {
        height: 10,
        borderRadius: 10,
        borderWidth: 1,
    },
});

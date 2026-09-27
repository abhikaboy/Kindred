import React from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { Check, Plus, Sparkle } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { SectionTitle } from "@/components/dashboard/SectionHeader";
import { STAGE } from "@/components/capture/CaptureStage";
import { getCategoryDuotoneColors } from "@/utils/categoryColors";
import { hasExactMatch, rankCategories, type CategoryOption } from "./categoryOptions";

export const categoryColor = (o: { id: string; name: string }, scheme: "light" | "dark") =>
    getCategoryDuotoneColors(o.id, o.name, scheme).dark;

type Props = {
    options: CategoryOption[];
    query: string;
    /** The fuzzy guess for this title, listed first. */
    suggestedId?: string;
    /** Current pick; undefined means Auto Sort. */
    selectedId?: string;
    /** Where "Create" puts a new category, and whose categories lead. */
    workspace: string;
    onPickAuto: () => void;
    onPick: (option: CategoryOption) => void;
    onCreate: (name: string) => void;
};

/**
 * The destination list, floating over the keyboard while the row below it is
 * a search field. Empty query: Auto Sort, the guess, then every workspace.
 * Typing: ranked matches, then a row to create what was typed.
 */
const CategoryPicker = ({ options, query, suggestedId, selectedId, workspace, onPickAuto, onPick, onCreate }: Props) => {
    const { height } = useWindowDimensions();
    const ThemedColor = useThemeColor();
    const q = query.trim();

    let body: React.ReactNode;
    if (!q) {
        const suggested = suggestedId ? options.find((o) => o.id === suggestedId) : undefined;
        const workspaces = [workspace, ...new Set(options.map((o) => o.workspace))].filter(
            (w, i, all) => all.indexOf(w) === i && options.some((o) => o.workspace === w)
        );
        body = (
            <>
                <Row
                    auto
                    name="Auto Sort"
                    caption="File it for me"
                    selected={!selectedId}
                    onPress={onPickAuto}
                />
                {suggested && (
                    <>
                        <SectionLabel text="Best match" />
                        <Row option={suggested} selected={selectedId === suggested.id} onPress={() => onPick(suggested)} />
                    </>
                )}
                {workspaces.map((w) => (
                    <React.Fragment key={w}>
                        <SectionLabel text={w} />
                        {options
                            .filter((o) => o.workspace === w)
                            .map((o) => (
                                <Row key={o.id} option={o} selected={selectedId === o.id} onPress={() => onPick(o)} />
                            ))}
                    </React.Fragment>
                ))}
            </>
        );
    } else {
        const matches = rankCategories(options, q, { suggestedId, workspace });
        body = (
            <>
                {matches.map((o) => (
                    <Row
                        key={o.id}
                        option={o}
                        caption={o.workspace}
                        selected={selectedId === o.id}
                        onPress={() => onPick(o)}
                    />
                ))}
                {!hasExactMatch(options, q, workspace) && (
                    <CreateRow name={q} workspace={workspace} onPress={() => onCreate(q)} />
                )}
            </>
        );
    }

    return (
        <View
            style={[
                styles.card,
                // Near-black card over the scrim, the same in both themes
                { maxHeight: height * 0.42, backgroundColor: "rgba(28,28,32,0.96)", borderColor: STAGE.hairline },
            ]}>
            <ScrollView keyboardShouldPersistTaps="always" contentContainerStyle={styles.list}>
                {body}
            </ScrollView>
        </View>
    );
};

export default CategoryPicker;

const SectionLabel = ({ text }: { text: string }) => (
    <SectionTitle title={text} style={[styles.section, { color: STAGE.text }]} />
);

const Row = ({
    option,
    auto,
    name,
    caption,
    selected,
    onPress,
}: {
    option?: CategoryOption;
    auto?: boolean;
    name?: string;
    caption?: string;
    selected: boolean;
    onPress: () => void;
}) => {
    const ThemedColor = useThemeColor();
    return (
        <TouchableOpacity
            onPress={onPress}
            style={styles.row}
            accessibilityRole="button"
            accessibilityState={{ selected }}>
            {auto ? (
                <Sparkle size={16} color={ThemedColor.primary} weight="fill" />
            ) : (
                <View
                    style={[
                        styles.bar,
                        { backgroundColor: option ? categoryColor(option, "dark") : STAGE.muted },
                    ]}
                />
            )}
            <View style={styles.rowText}>
                <ThemedText type="default" numberOfLines={1} style={{ color: STAGE.text }}>
                    {name ?? option?.name}
                </ThemedText>
                {!!caption && (
                    <ThemedText type="caption" numberOfLines={1} style={{ color: STAGE.muted }}>
                        {caption}
                    </ThemedText>
                )}
            </View>
            {selected && <Check size={16} color={STAGE.text} weight="bold" />}
        </TouchableOpacity>
    );
};

const CreateRow = ({ name, workspace, onPress }: { name: string; workspace: string; onPress: () => void }) => {
    const ThemedColor = useThemeColor();
    return (
        <TouchableOpacity onPress={onPress} style={styles.row} accessibilityRole="button">
            <Plus size={16} color={STAGE.text} weight="bold" />
            <View style={styles.rowText}>
                <ThemedText type="default" numberOfLines={1} style={{ color: STAGE.text }}>
                    Create “{name}”
                </ThemedText>
                <ThemedText type="caption" numberOfLines={1} style={{ color: STAGE.muted }}>
                    New category in {workspace}
                </ThemedText>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
    list: { paddingVertical: 8 },
    section: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        minHeight: 44,
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    // Square-cornered like the planner rows' category bar
    bar: { width: 4, height: 20 },
    rowText: { flex: 1 },
});

import React, { useCallback, useMemo, useRef } from "react";
import { ScrollView, TouchableOpacity, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import Ionicons from "@expo/vector-icons/Ionicons";
import { FunnelSimple, SortAscending } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import { Category } from "@/components/category";
import { useTasks } from "@/contexts/tasksContext";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useWorkspaceFilters } from "@/hooks/useWorkspaceFilters";
import { useWorkspaceState } from "@/hooks/useWorkspaceState";
import { SortContent, FilterContent } from "@/components/ListControls";
import { sortCategories } from "@/utils/categorySort";

export default function TagView() {
    const { tag } = useLocalSearchParams<{ tag: string }>();
    const router = useRouter();
    const ThemedColor = useThemeColor();
    const { getCategoriesByTag } = useTasks();

    const tagValue = (Array.isArray(tag) ? tag[0] : tag) ?? "";
    // Scope filter/sort state to this tag (independent of any workspace).
    const storageKey = `tag:${tagValue}`;
    const { applyFilters } = useWorkspaceFilters(storageKey);
    const { state } = useWorkspaceState(storageKey);

    const matches = useMemo(() => getCategoriesByTag(tagValue), [getCategoriesByTag, tagValue]);

    // Sort is applied as a derived ordering — we can't reorder global state
    // because these categories span multiple workspaces.
    const ordered = useMemo(() => {
        if (!state.sort) return matches;
        const sortedCats = sortCategories(
            matches.map((m) => m.category),
            state.sort,
            state.sortDirection ?? "descending"
        );
        return sortedCats
            .map((cat) => matches.find((m) => m.category.id === cat.id))
            .filter((m): m is (typeof matches)[number] => m !== undefined);
    }, [matches, state.sort, state.sortDirection]);

    const sortSheetRef = useRef<BottomSheetModal>(null);
    const filterSheetRef = useRef<BottomSheetModal>(null);
    const sortSnapPoints = useMemo(() => ["40%"], []);
    const filterSnapPoints = useMemo(() => ["50%"], []);

    const renderBackdrop = useCallback(
        (backdropProps) => (
            <BottomSheetBackdrop {...backdropProps} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
        ),
        []
    );

    return (
        <SafeAreaView style={{ flex: 1 }}>
            <Stack.Screen options={{ headerShown: false }} />
            <View
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    paddingHorizontal: 20,
                    paddingTop: 8,
                }}>
                {router.canGoBack() && (
                    <TouchableOpacity onPress={() => router.back()} hitSlop={8} accessibilityLabel="Go back">
                        <Ionicons name="chevron-back" size={28} color={ThemedColor.text} />
                    </TouchableOpacity>
                )}
                <ThemedText type="title" style={{ flex: 1 }}>
                    #{tagValue}
                </ThemedText>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
                    <TouchableOpacity onPress={() => filterSheetRef.current?.present()} hitSlop={8} accessibilityLabel="Filter">
                        <FunnelSimple
                            size={20}
                            weight="regular"
                            color={state.filters !== null ? ThemedColor.primary : ThemedColor.caption}
                        />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => sortSheetRef.current?.present()} hitSlop={8} accessibilityLabel="Sort">
                        <SortAscending
                            size={20}
                            weight="regular"
                            color={state.sort !== null ? ThemedColor.primary : ThemedColor.caption}
                        />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20, gap: 24 }}>
                {ordered.length === 0 ? (
                    <ThemedText type="caption">No categories tagged "{tagValue}" yet.</ThemedText>
                ) : (
                    ordered.map(({ workspaceName, category }) => (
                        <View key={category.id} style={{ gap: 8 }}>
                            <ThemedText type="caption">{workspaceName}</ThemedText>
                            <Category
                                id={category.id}
                                name={category.name}
                                tasks={applyFilters(category.tasks)}
                                tags={category.tags}
                                viewOnly
                                onPress={() => {}}
                                onLongPress={() => {}}
                            />
                        </View>
                    ))
                )}
            </ScrollView>

            <BottomSheetModal
                ref={sortSheetRef}
                index={0}
                snapPoints={sortSnapPoints}
                backdropComponent={renderBackdrop}
                handleIndicatorStyle={{ backgroundColor: ThemedColor.text }}
                backgroundStyle={{ backgroundColor: ThemedColor.background }}
                enablePanDownToClose={true}>
                <BottomSheetView style={{ paddingHorizontal: 20, paddingBottom: 20, flex: 1 }}>
                    <SortContent storageKey={storageKey} onApply={() => sortSheetRef.current?.dismiss()} />
                </BottomSheetView>
            </BottomSheetModal>

            <BottomSheetModal
                ref={filterSheetRef}
                index={0}
                snapPoints={filterSnapPoints}
                backdropComponent={renderBackdrop}
                handleIndicatorStyle={{ backgroundColor: ThemedColor.text }}
                backgroundStyle={{ backgroundColor: ThemedColor.background }}
                enablePanDownToClose={true}>
                <BottomSheetView style={{ paddingHorizontal: 20, paddingBottom: 20, flex: 1 }}>
                    <FilterContent storageKey={storageKey} onApply={() => filterSheetRef.current?.dismiss()} />
                </BottomSheetView>
            </BottomSheetModal>
        </SafeAreaView>
    );
}

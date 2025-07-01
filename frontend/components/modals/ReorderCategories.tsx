import { TouchableOpacity, View, ViewProps } from "react-native";
import React, { useState } from "react";
import { ThemedText } from "../ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useTasks } from "@/contexts/tasksContext";
import DefaultCard from "../cards/DefaultCard";
import DraggableFlatList from "react-native-draggable-flatlist";
import PrimaryButton from "../inputs/PrimaryButton";

type Props = {
    hide: () => void;
};

const SortByCard = ({ children }: ViewProps) => {
    return (
        <TouchableOpacity>
            <DefaultCard>
                <ThemedText type="defaultSemiBold">{children}</ThemedText>
            </DefaultCard>
        </TouchableOpacity>
    );
};
const ReorderCategories = (props: Props) => {
    const ThemedColor = useThemeColor();
    const { categories } = useTasks();
    const [reorderedCategories, setReorderedCategories] = useState<any[]>(categories);
    const [reordering, setReordering] = useState(false);

    return (
        <View style={{ gap: 24, display: "flex", flexDirection: "column" }}>
            <ThemedText type="subtitle">Sort By</ThemedText>
            <View style={{ gap: 4, display: "flex", flexDirection: "column" }}>
                <SortByCard>Task Count</SortByCard>
                <SortByCard>Last Edited</SortByCard>
            </View>
            <PrimaryButton
                title="Sort"
                outline={reordering}
                onPress={() => {
                    props.hide();
                }}
            />
            <ThemedText type="subtitle">Reorder Categories</ThemedText>
            <View style={{ gap: 4, display: "flex", flexDirection: "column" }}>
                <DraggableFlatList
                    data={reorderedCategories}
                    onDragBegin={() => {
                        setReordering(true);
                    }}
                    onDragEnd={({ data }) => {
                        setReorderedCategories(data);
                    }}
                    renderItem={({ item, drag, isActive }) => (
                        <TouchableOpacity
                            key={item.id}
                            onLongPress={drag}
                            style={{ opacity: isActive ? 0.5 : 1, transform: [{ scale: isActive ? 0.95 : 1 }] }}>
                            <DefaultCard key={item.id}>
                                <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
                            </DefaultCard>
                        </TouchableOpacity>
                    )}
                    keyExtractor={(item) => item.id}
                />
            </View>
            <PrimaryButton
                title="Save Reordering"
                outline={!reordering}
                onPress={() => {
                    props.hide();
                }}
            />
        </View>
    );
};

export default ReorderCategories;

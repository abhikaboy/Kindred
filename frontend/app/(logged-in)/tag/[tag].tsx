import React, { useMemo } from "react";
import { ScrollView, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemedText } from "@/components/ThemedText";
import { Category } from "@/components/category";
import { useTasks } from "@/contexts/tasksContext";

export default function TagView() {
    const { tag } = useLocalSearchParams<{ tag: string }>();
    const router = useRouter();
    const { getCategoriesByTag } = useTasks();

    const tagValue = (Array.isArray(tag) ? tag[0] : tag) ?? "";
    const matches = useMemo(() => getCategoriesByTag(tagValue), [getCategoriesByTag, tagValue]);

    return (
        <SafeAreaView style={{ flex: 1 }}>
            <Stack.Screen options={{ title: `#${tagValue}` }} />
            <ScrollView contentContainerStyle={{ padding: 20, gap: 24 }}>
                <ThemedText type="title">#{tagValue}</ThemedText>
                {matches.length === 0 ? (
                    <ThemedText type="caption">No categories tagged "{tagValue}" yet.</ThemedText>
                ) : (
                    matches.map(({ workspaceName, category }) => (
                        <View key={category.id} style={{ gap: 8 }}>
                            <ThemedText type="caption">{workspaceName}</ThemedText>
                            <Category
                                id={category.id}
                                name={category.name}
                                tasks={category.tasks}
                                tags={category.tags}
                                viewOnly
                                onPress={() => {}}
                                onLongPress={() => {}}
                            />
                        </View>
                    ))
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

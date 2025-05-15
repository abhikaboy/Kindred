import React, { useEffect } from "react";
import { View, StyleSheet, ScrollView, Image } from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Feather from "@expo/vector-icons/Feather";
import { useBlueprints } from "@/contexts/blueprintContext";
import PreviewIcon from "@/components/profile/PreviewIcon";

export default function BlueprintDetailScreen() {
    const { id } = useLocalSearchParams();
    const ThemedColor = useThemeColor();
    const styles = stylesheet(ThemedColor);

    const { selectedBlueprint, getBlueprintById, setSelectedBlueprint } = useBlueprints();

    if (!selectedBlueprint) {
        return (
            <ThemedView>
                <ThemedText type="subtitle">Navigate back to the homey homee page.</ThemedText>
            </ThemedView>
        );
    }

    return (
        <>
            <ThemedView>
                <ScrollView>
                    <Image
                        source={{ uri: selectedBlueprint.previewImage }}
                        style={{
                            height: 234,
                        }}
                    />

                    <View style={styles.informationContainer}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                            <View style={{ flexDirection: "row", gap: 14 }}>
                                <PreviewIcon icon={selectedBlueprint.userImage} size={"medium"}></PreviewIcon>

                                <View style={{ flexDirection: "column" }}>
                                    <ThemedText type="default">{selectedBlueprint.name}</ThemedText>
                                    <ThemedText type="caption">{selectedBlueprint.username}</ThemedText>
                                </View>
                            </View>

                            <PrimaryButton
                                style={{ height: 38, width: 85, paddingVertical: 10, paddingHorizontal: 10 }}
                                title={"Subscribe"}
                                onPress={() => console.log("subscribed to")}></PrimaryButton>
                        </View>
                        <ThemedText type="subtitle">{selectedBlueprint.workspaceName}</ThemedText>
                        <ThemedText type="default">{selectedBlueprint.description}</ThemedText>

                        <View style={{ flexDirection: "row", gap: 5, alignItems: "center" }}>
                            <MaterialIcons name="access-alarm" size={20} color={ThemedColor.text} />{" "}
                            <ThemedText type="smallerDefault">{selectedBlueprint.time}</ThemedText>
                        </View>

                        <View style={{ flexDirection: "row", gap: 5, alignItems: "center" }}>
                            <Feather name="users" size={18} color={ThemedColor.caption} />

                            <ThemedText type="caption">{selectedBlueprint.subscriberCount} subscribers</ThemedText>
                        </View>
                        <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
                            {selectedBlueprint.tags.map((tag, index) => (
                                <ThemedText
                                    key={index}
                                    style={[styles.tag, { borderColor: ThemedColor.primaryPressed }]}
                                    type="smallerDefault">
                                    {tag}
                                </ThemedText>
                            ))}
                        </View>
                    </View>
                </ScrollView>
            </ThemedView>
        </>
    );
}

const stylesheet = (ThemedColor: any) =>
    StyleSheet.create({
        container: {
            width: 280,
            flexDirection: "column",
        },
        informationContainer: {
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            flexDirection: "column",
            paddingHorizontal: 15,
            paddingVertical: 18,
            gap: 13,
            backgroundColor: ThemedColor.background,
            marginTop: -20,
        },
        tag: {
            borderWidth: 1,
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 5,
            marginBottom: 4,
        },
    });

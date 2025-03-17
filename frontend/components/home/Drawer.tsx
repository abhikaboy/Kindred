import { useTasks } from "@/contexts/tasksContext";
import React from "react";
import { View, TouchableOpacity } from "react-native";
import SelectedIndicator from "../SelectedIndicator";
import { ThemedText } from "../ThemedText";
import ThemedColor from "@/constants/Colors";
import { Dimensions, StyleSheet } from "react-native";

export const Drawer = ({ close }) => {
    const { workspaces, selected, setSelected } = useTasks();
    return (
        <View style={styles.drawerContainer}>
            <View style={{ paddingTop: 16, paddingBottom: 16 }}>
                <ThemedText type="title">Workspaces</ThemedText>
            </View>
            <View style={{ width: " 100%" }}>
                {workspaces.map((workspace) => (
                    <TouchableOpacity
                        style={[
                            {
                                paddingVertical: 12,
                                flexDirection: "row",
                                width: "100%",
                                borderRadius: 16,
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                            },
                            selected == workspace.name ? { backgroundColor: "#1C1B2A" } : undefined,
                        ]}
                        onPress={() => {
                            setSelected(workspace.name);
                            close();
                        }}
                        key={workspace.name}>
                        <SelectedIndicator selected={selected === workspace.name} />
                        <ThemedText type="defaultSemiBold" key={workspace.name}>
                            {workspace.name}
                        </ThemedText>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
};
const styles = StyleSheet.create({
    drawerContainer: {
        flex: 1,
        flexDirection: "column",
        justifyContent: "flex-start",
        alignItems: "flex-start",
        paddingHorizontal: 24,
        paddingTop: 64,
        backgroundColor: ThemedColor.lightened,
        width: Dimensions.get("screen").width * 0.75,
        zIndex: 80,
    },
});

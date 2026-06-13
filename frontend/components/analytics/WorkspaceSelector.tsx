import React, { useState } from "react";
import { View, StyleSheet, TouchableOpacity, Modal, Pressable } from "react-native";
import { CaretDown, Check } from "phosphor-react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "@/components/ThemedText";

interface Props {
    workspaces: string[];
    selected?: string;
    onSelect: (workspace?: string) => void;
}

const ALL_LABEL = "All Workspaces";

export function WorkspaceSelector({ workspaces, selected, onSelect }: Props) {
    const ThemedColor = useThemeColor() as any;
    const styles = stylesheet(ThemedColor);
    const [open, setOpen] = useState(false);

    const choose = (ws?: string) => {
        onSelect(ws);
        setOpen(false);
    };

    return (
        <>
            <TouchableOpacity style={styles.trigger} activeOpacity={0.7} onPress={() => setOpen(true)}>
                <ThemedText type="defaultSemiBold">{selected ?? ALL_LABEL}</ThemedText>
                <CaretDown size={16} color={ThemedColor.text} weight="bold" />
            </TouchableOpacity>

            <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
                <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
                    <View style={styles.sheet}>
                        <WorkspaceOption label={ALL_LABEL} active={!selected} onPress={() => choose(undefined)} />
                        {workspaces.map((ws) => (
                            <WorkspaceOption key={ws} label={ws} active={selected === ws} onPress={() => choose(ws)} />
                        ))}
                    </View>
                </Pressable>
            </Modal>
        </>
    );
}

function WorkspaceOption({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
    const ThemedColor = useThemeColor() as any;
    const styles = stylesheet(ThemedColor);
    return (
        <TouchableOpacity style={styles.option} activeOpacity={0.7} onPress={onPress}>
            <ThemedText type={active ? "defaultSemiBold" : "default"}>{label}</ThemedText>
            {active ? <Check size={18} color={ThemedColor.primary} weight="bold" /> : null}
        </TouchableOpacity>
    );
}

const stylesheet = (ThemedColor: any) =>
    StyleSheet.create({
        trigger: {
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            alignSelf: "flex-start",
        },
        overlay: {
            flex: 1,
            backgroundColor: "#00000066",
            justifyContent: "flex-start",
            paddingTop: 160,
            paddingHorizontal: 24,
        },
        sheet: {
            backgroundColor: ThemedColor.lightenedCard,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: ThemedColor.tertiary,
            paddingVertical: 6,
        },
        option: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingVertical: 14,
        },
    });

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, TextInput } from "react-native";
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "@/components/ThemedText";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { logProgressAPI, type RingDelta } from "@/api/task";
import { showToast } from "@/utils/showToast";
import type { components } from "@/api/generated/types";

type TaskDocument = components["schemas"]["TaskDocument"];

type Props = {
    visible: boolean;
    setVisible: (visible: boolean) => void;
    taskId: string;
    categoryId: string;
    onLogged?: (entry: TaskDocument, ringDelta?: RingDelta) => void;
};

// v1 (manual entry only, per the Sessions proposal): duration + optional note.
// Photo attachment and Live Activity duration prefill are future iterations.
const LogProgressBottomSheetModal = ({ visible, setVisible, taskId, categoryId, onLogged }: Props) => {
    const ThemedColor = useThemeColor();
    const sheetRef = useRef<BottomSheetModal>(null);
    const isPresentingRef = useRef(false);
    const snapPoints = useMemo(() => ["50%"], []);

    const [minutes, setMinutes] = useState("");
    const [note, setNote] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (visible) {
            isPresentingRef.current = true;
            sheetRef.current?.dismiss();
            const timer = setTimeout(() => {
                sheetRef.current?.present();
                setTimeout(() => {
                    isPresentingRef.current = false;
                }, 500);
            }, 100);
            return () => {
                clearTimeout(timer);
                isPresentingRef.current = false;
            };
        } else {
            sheetRef.current?.dismiss();
        }
    }, [visible]);

    const handleSheetChanges = useCallback((index: number) => {
        if (index === -1 && !isPresentingRef.current) {
            setVisible(false);
        }
    }, [setVisible]);

    const renderBackdrop = useCallback(
        (props) => (
            <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} enableTouchThrough={false} />
        ),
        []
    );

    const hideModal = () => {
        setVisible(false);
        sheetRef.current?.dismiss();
    };

    const handleSave = async () => {
        const durationSeconds = Math.round(parseFloat(minutes) * 60);
        if (!durationSeconds || durationSeconds <= 0) {
            showToast("Enter how long you worked on this", "danger");
            return;
        }

        setSaving(true);
        try {
            const { entry, ringDelta } = await logProgressAPI(categoryId, taskId, {
                durationSeconds,
                note: note.trim() || undefined,
            });
            setMinutes("");
            setNote("");
            onLogged?.(entry, ringDelta);
            hideModal();
            showToast("Progress logged", "success");
        } catch (error) {
            console.error("Failed to log progress:", error);
            showToast("Failed to log progress", "danger");
        } finally {
            setSaving(false);
        }
    };

    return (
        <BottomSheetModal
            ref={sheetRef}
            index={0}
            snapPoints={snapPoints}
            onChange={handleSheetChanges}
            backdropComponent={renderBackdrop}
            handleIndicatorStyle={{ backgroundColor: ThemedColor.text }}
            backgroundStyle={{ backgroundColor: ThemedColor.background }}
            enablePanDownToClose={true}>
            <BottomSheetScrollView
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, flexGrow: 1, gap: 16 }}
                keyboardShouldPersistTaps="handled">
                <ThemedText type="subtitle">Log Progress</ThemedText>
                <View style={{ gap: 8 }}>
                    <ThemedText type="lightBody" style={{ color: ThemedColor.caption }}>
                        Time spent
                    </ThemedText>
                    <TextInput
                        value={minutes}
                        onChangeText={setMinutes}
                        placeholder="Minutes"
                        placeholderTextColor={ThemedColor.caption}
                        keyboardType="numeric"
                        style={{
                            fontSize: 20,
                            color: ThemedColor.text,
                            fontFamily: "OutfitLight",
                            borderBottomWidth: 1,
                            borderBottomColor: ThemedColor.lightened,
                            paddingVertical: 8,
                        }}
                    />
                </View>
                <View style={{ gap: 8 }}>
                    <ThemedText type="lightBody" style={{ color: ThemedColor.caption }}>
                        Note (optional)
                    </ThemedText>
                    <TextInput
                        value={note}
                        onChangeText={setNote}
                        placeholder="What did you get done?"
                        placeholderTextColor={ThemedColor.caption}
                        multiline
                        style={{
                            fontSize: 16,
                            color: ThemedColor.text,
                            fontFamily: "OutfitLight",
                            minHeight: 80,
                            textAlignVertical: "top",
                        }}
                    />
                </View>
                <PrimaryButton title={saving ? "Saving..." : "Save progress"} onPress={handleSave} disabled={saving} />
            </BottomSheetScrollView>
        </BottomSheetModal>
    );
};

export default LogProgressBottomSheetModal;

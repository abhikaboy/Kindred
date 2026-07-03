import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import { useThemeColor } from "@/hooks/useThemeColor";
import { updateTaskRemindersAPI } from "@/api/task";
import ReminderComponent from "./create/Reminder";
import { showToast } from "@/utils/showToast";
import { useTimeouts } from "@/hooks/useTimeouts";

type ReminderType = {
    triggerTime: string;
    type: string;
    message?: string;
};

type Props = {
    visible: boolean;
    setVisible: (visible: boolean) => void;
    taskId?: string;
    categoryId?: string;
    onReminderUpdate?: (reminders: ReminderType[]) => void;
};

const ReminderBottomSheetModal = ({ visible, setVisible, taskId, categoryId, onReminderUpdate }: Props) => {
    const ThemedColor = useThemeColor();
    const setT = useTimeouts();
    const reminderSheetRef = useRef<BottomSheetModal>(null);
    const isPresentingRef = useRef(false);
    const snapPoints = useMemo(() => ["60%", "90%"], []);

    // Handle modal visibility changes — dismiss before present to reset internal state
    useEffect(() => {
        if (visible) {
            isPresentingRef.current = true;
            reminderSheetRef.current?.dismiss();
            const timer = setTimeout(() => {
                reminderSheetRef.current?.present();
                setT(() => {
                    isPresentingRef.current = false;
                }, 500);
            }, 100);
            return () => {
                clearTimeout(timer);
                isPresentingRef.current = false;
            };
        } else {
            reminderSheetRef.current?.dismiss();
        }
    }, [visible]);

    const handleSheetChanges = useCallback((index: number) => {
        if (index === -1 && !isPresentingRef.current) {
            setVisible(false);
        }
    }, [setVisible]);

    const renderBackdrop = useCallback(
        (props) => (
            <BottomSheetBackdrop
                {...props}
                disappearsOnIndex={-1}
                appearsOnIndex={0}
                opacity={0.5}
                enableTouchThrough={false}
            />
        ),
        []
    );

    const hideModal = () => {
        setVisible(false);
        reminderSheetRef.current?.dismiss();
    };

    const handleReminderSubmit = async (reminders: ReminderType[]) => {
        if (taskId && categoryId) {
            try {
                await updateTaskRemindersAPI(categoryId, taskId, reminders);
            } catch (error) {
                console.error("Failed to update reminders:", error);
                showToast("Failed to update reminders", "danger");
                return;
            }
        }

        if (onReminderUpdate) {
            onReminderUpdate(reminders);
        }

        hideModal();
    };

    return (
        <BottomSheetModal
            ref={reminderSheetRef}
            index={0}
            snapPoints={snapPoints}
            onChange={handleSheetChanges}
            backdropComponent={renderBackdrop}
            handleIndicatorStyle={{ backgroundColor: ThemedColor.text }}
            backgroundStyle={{ backgroundColor: ThemedColor.background }}
            enablePanDownToClose={true}>
            <BottomSheetView
                style={{
                    paddingHorizontal: 20,
                }}>
                <ReminderComponent
                    goToStandard={hideModal}
                    onSubmit={handleReminderSubmit}
                />
            </BottomSheetView>
        </BottomSheetModal>
    );
};

export default ReminderBottomSheetModal;

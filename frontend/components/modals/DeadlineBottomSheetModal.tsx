import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useThemeColor } from "@/hooks/useThemeColor";
import { updateTaskDeadlineAPI } from "@/api/task";
import Deadline from "./create/Deadline";
import { showToast } from "@/utils/showToast";

type Props = {
    visible: boolean;
    setVisible: (visible: boolean) => void;
    taskId?: string;
    categoryId?: string;
    onDeadlineUpdate?: (deadline: Date | null) => void;
};

const DeadlineBottomSheetModal = ({ visible, setVisible, taskId, categoryId, onDeadlineUpdate }: Props) => {
    const ThemedColor = useThemeColor();
    const deadlineSheetRef = useRef<BottomSheetModal>(null);
    const isPresentingRef = useRef(false);
    const snapPoints = useMemo(() => ["90%"], []);

    // Handle modal visibility changes — dismiss before present to reset internal state
    useEffect(() => {
        if (visible) {
            isPresentingRef.current = true;
            deadlineSheetRef.current?.dismiss();
            const timer = setTimeout(() => {
                deadlineSheetRef.current?.present();
                setTimeout(() => {
                    isPresentingRef.current = false;
                }, 500);
            }, 100);
            return () => {
                clearTimeout(timer);
                isPresentingRef.current = false;
            };
        } else {
            deadlineSheetRef.current?.dismiss();
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
        deadlineSheetRef.current?.dismiss();
    };

    const handleDeadlineSubmit = async (deadline: Date | null) => {
        if (taskId && categoryId) {
            try {
                await updateTaskDeadlineAPI(categoryId, taskId, deadline);
            } catch (error) {
                console.error("Failed to update deadline:", error);
                showToast("Failed to update deadline", "danger");
                return;
            }
        }

        if (onDeadlineUpdate) {
            onDeadlineUpdate(deadline);
        }

        hideModal();
    };

    return (
        <BottomSheetModal
            ref={deadlineSheetRef}
            index={0}
            snapPoints={snapPoints}
            onChange={handleSheetChanges}
            backdropComponent={renderBackdrop}
            handleIndicatorStyle={{ backgroundColor: ThemedColor.text }}
            backgroundStyle={{ backgroundColor: ThemedColor.background }}
            enablePanDownToClose={true}>
            <BottomSheetScrollView
                contentContainerStyle={{
                    paddingHorizontal: 20,
                    paddingBottom: 40,
                    flexGrow: 1,
                }}
                keyboardShouldPersistTaps="handled">
                <Deadline
                    goToStandard={hideModal}
                    onSubmit={handleDeadlineSubmit}
                />
            </BottomSheetScrollView>
        </BottomSheetModal>
    );
};

export default DeadlineBottomSheetModal;

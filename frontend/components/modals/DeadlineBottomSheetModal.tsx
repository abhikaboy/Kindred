import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import { useThemeColor } from "@/hooks/useThemeColor";
import { updateTaskDeadlineAPI } from "@/api/task";
import Deadline from "./create/Deadline";

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
    const snapPoints = useMemo(() => ["90%"], []);

    // Handle modal visibility changes
    useEffect(() => {
        if (visible) {
            deadlineSheetRef.current?.present();
        } else {
            deadlineSheetRef.current?.dismiss();
        }
    }, [visible]);

    const handleSheetChanges = useCallback((index: number) => {
        if (index === -1) {
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
                console.log("Successfully updated deadline for task:", taskId, "in category:", categoryId, "to:", deadline);
            } catch (error) {
                console.error("Failed to update deadline:", error);
                // TODO: Show error toast/alert
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
            <BottomSheetView
                style={{
                    paddingHorizontal: 20,
                }}>
                <Deadline 
                    goToStandard={hideModal}
                    onSubmit={handleDeadlineSubmit}
                />
            </BottomSheetView>
        </BottomSheetModal>
    );
};

export default DeadlineBottomSheetModal;

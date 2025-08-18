import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import { useThemeColor } from "@/hooks/useThemeColor";
import { updateTaskStartAPI } from "@/api/task";
import StartDate from "./create/StartDate";

type Props = {
    visible: boolean;
    setVisible: (visible: boolean) => void;
    taskId?: string;
    categoryId?: string;
    onStartDateUpdate?: (startDate: Date | null, startTime?: Date | null) => void;
};

const StartDateBottomSheetModal = ({ visible, setVisible, taskId, categoryId, onStartDateUpdate }: Props) => {
    const ThemedColor = useThemeColor();
    const startDateSheetRef = useRef<BottomSheetModal>(null);
    const snapPoints = useMemo(() => ["50%", "80%"], []);

    // Handle modal visibility changes
    useEffect(() => {
        if (visible) {
            startDateSheetRef.current?.present();
        } else {
            startDateSheetRef.current?.dismiss();
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
        startDateSheetRef.current?.dismiss();
    };

    const handleStartDateSubmit = async (startDate: Date | null, startTime?: Date | null) => {
        if (taskId && categoryId) {
            try {
                await updateTaskStartAPI(categoryId, taskId, startDate, startTime);
                console.log("Successfully updated start date/time for task:", taskId, "in category:", categoryId, "to:", startDate, startTime);
            } catch (error) {
                console.error("Failed to update start date/time:", error);
                // TODO: Show error toast/alert
                return;
            }
        }
        
        if (onStartDateUpdate) {
            onStartDateUpdate(startDate, startTime);
        }
        
        hideModal();
    };

    return (
        <BottomSheetModal
            ref={startDateSheetRef}
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
                <StartDate 
                    goToStandard={hideModal}
                    onSubmit={handleStartDateSubmit}
                />
            </BottomSheetView>
        </BottomSheetModal>
    );
};

export default StartDateBottomSheetModal;

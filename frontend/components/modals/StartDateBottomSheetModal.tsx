import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import { useThemeColor } from "@/hooks/useThemeColor";
import { updateTaskStartAPI } from "@/api/task";
import StartDate from "./create/StartDate";
import { showToast } from "@/utils/showToast";
import { useTimeouts } from "@/hooks/useTimeouts";

type Props = {
    visible: boolean;
    setVisible: (visible: boolean) => void;
    taskId?: string;
    categoryId?: string;
    onStartDateUpdate?: (startDate: Date | null, startTime?: Date | null) => void;
};

const StartDateBottomSheetModal = ({ visible, setVisible, taskId, categoryId, onStartDateUpdate }: Props) => {
    const ThemedColor = useThemeColor();
    const setT = useTimeouts();
    const startDateSheetRef = useRef<BottomSheetModal>(null);
    const isPresentingRef = useRef(false);
    const snapPoints = useMemo(() => ["50%", "80%"], []);

    // Handle modal visibility changes — dismiss before present to reset internal state
    useEffect(() => {
        if (visible) {
            isPresentingRef.current = true;
            startDateSheetRef.current?.dismiss();
            const timer = setTimeout(() => {
                startDateSheetRef.current?.present();
                setT(() => {
                    isPresentingRef.current = false;
                }, 500);
            }, 100);
            return () => {
                clearTimeout(timer);
                isPresentingRef.current = false;
            };
        } else {
            startDateSheetRef.current?.dismiss();
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
        startDateSheetRef.current?.dismiss();
    };

    const handleStartDateSubmit = async (startDate: Date | null, startTime?: Date | null) => {
        if (taskId && categoryId) {
            try {
                await updateTaskStartAPI(categoryId, taskId, startDate, startTime);
            } catch (error) {
                console.error("Failed to update start date/time:", error);
                showToast("Failed to update start date", "danger");
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

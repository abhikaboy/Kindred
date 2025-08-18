import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import { useThemeColor } from "@/hooks/useThemeColor";
import NewWorkspace from "./create/NewWorkspace";

type Props = {
    visible: boolean;
    setVisible: (visible: boolean) => void;
};

const CreateWorkspaceBottomSheetModal = ({ visible, setVisible }: Props) => {
    const ThemedColor = useThemeColor();
    const createWorkspaceSheetRef = useRef<BottomSheetModal>(null);
    const snapPoints = useMemo(() => ["30%"], []);

    // Handle modal visibility changes
    useEffect(() => {
        if (visible) {
            createWorkspaceSheetRef.current?.present();
        } else {
            createWorkspaceSheetRef.current?.dismiss();
        }
    }, [visible]);

    const handleCreateSheetChanges = useCallback((index: number) => {
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
        createWorkspaceSheetRef.current?.dismiss();
    };

    return (
        <BottomSheetModal
            ref={createWorkspaceSheetRef}
            index={0}
            snapPoints={snapPoints}
            onChange={handleCreateSheetChanges}
            backdropComponent={renderBackdrop}
            handleIndicatorStyle={{ backgroundColor: ThemedColor.text }}
            backgroundStyle={{ backgroundColor: ThemedColor.background }}
            enablePanDownToClose={true}>
            <BottomSheetView
                style={{
                    paddingHorizontal: 20,
                }}>
                <NewWorkspace hide={hideModal} />
            </BottomSheetView>
        </BottomSheetModal>
    );
};

export default CreateWorkspaceBottomSheetModal;

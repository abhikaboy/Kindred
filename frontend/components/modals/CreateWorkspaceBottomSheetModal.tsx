import React, { useCallback, useEffect, useRef } from "react";
import { Keyboard } from "react-native";
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
    // Track whether the icon picker is open imperatively — no state, no re-renders.
    const iconPickerOpenRef = useRef(false);

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
            // Only allow close if the icon picker is not open. If it snapped
            // down while the icon picker was open, snap it back immediately.
            if (iconPickerOpenRef.current) {
                requestAnimationFrame(() => {
                    createWorkspaceSheetRef.current?.snapToIndex(0);
                });
            } else {
                setVisible(false);
            }
        }
    }, [setVisible]);

    const handleIconPickerVisibilityChange = useCallback((open: boolean) => {
        iconPickerOpenRef.current = open;
        if (open) {
            // Dismiss keyboard first so the sheet doesn't get repositioned by
            // keyboardBlurBehavior, then snap back to ensure correct position.
            Keyboard.dismiss();
            requestAnimationFrame(() => {
                createWorkspaceSheetRef.current?.snapToIndex(0);
            });
        } else {
            // Overlay closed — snap back in case the sheet drifted.
            requestAnimationFrame(() => {
                createWorkspaceSheetRef.current?.snapToIndex(0);
            });
        }
    }, []);

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
            enableDynamicSizing={true}
            onChange={handleCreateSheetChanges}
            backdropComponent={renderBackdrop}
            handleIndicatorStyle={{ backgroundColor: ThemedColor.text }}
            backgroundStyle={{ backgroundColor: ThemedColor.background }}
            enablePanDownToClose={true}
            keyboardBehavior="interactive"
            keyboardBlurBehavior="restore">
            <BottomSheetView
                style={{
                    paddingHorizontal: 20,
                    paddingBottom: 32,
                }}>
                <NewWorkspace hide={hideModal} onIconPickerVisibilityChange={handleIconPickerVisibilityChange} />
            </BottomSheetView>
        </BottomSheetModal>
    );
};

export default CreateWorkspaceBottomSheetModal;

import { Dimensions, StyleSheet } from "react-native";
import React, { useCallback, useEffect, useRef, memo, useMemo, ReactNode } from "react";
import { useThemeColor } from "@/hooks/useThemeColor";
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import { HORIZONTAL_PADDING } from "@/constants/spacing";

type Props = {
    visible: boolean;
    setVisible: (visible: boolean) => void;
    children: ReactNode;
    snapPoints?: string[];
    enablePanDownToClose?: boolean;
    backdropOpacity?: number;
    customPadding?: boolean;
};

// Using memo to prevent unnecessary re-renders
const DefaultModal = memo((props: Props) => {
    const ThemedColor = useThemeColor();

    // Reference to the bottom sheet modal
    const bottomSheetModalRef = useRef<BottomSheetModal>(null);

    // Default snap points if none provided
    const defaultSnapPoints = useMemo(() => ["80%"], []);
    const snapPoints = props.snapPoints || defaultSnapPoints;

    // Handle opening and closing the bottom sheet
    useEffect(() => {
        if (props.visible) {
            bottomSheetModalRef.current?.present();
        } else {
            bottomSheetModalRef.current?.dismiss();
        }
    }, [props.visible]);

    // Safe way to update parent state when sheet is dismissed
    const handleSheetChanges = useCallback(
        (index: number) => {
            if (index === -1 && props.visible) {
                props.setVisible(false);
            }
        },
        [props.visible, props.setVisible]
    );

    // Custom backdrop component
    const renderBackdrop = useCallback(
        (backdropProps) => (
            <BottomSheetBackdrop
                {...backdropProps}
                disappearsOnIndex={-1}
                appearsOnIndex={0}
                opacity={props.backdropOpacity || 0.7}
            />
        ),
        [props.backdropOpacity]
    );

    // Content container styles
    const styles = StyleSheet.create({
        contentContainer: {
            paddingHorizontal: props.customPadding ? 0 : HORIZONTAL_PADDING,
            paddingTop: props.customPadding ? 0 : 16,
            paddingBottom: props.customPadding ? 0 : 32,
            flex: 1,
        },
    });

    return (
        <BottomSheetModal
            ref={bottomSheetModalRef}
            index={0}
            snapPoints={snapPoints}
            onChange={handleSheetChanges}
            backdropComponent={renderBackdrop}
            handleIndicatorStyle={{ backgroundColor: ThemedColor.text }}
            backgroundStyle={{ backgroundColor: ThemedColor.background }}
            enablePanDownToClose={props.enablePanDownToClose !== false}>
            <BottomSheetView style={styles.contentContainer}>{props.children}</BottomSheetView>
        </BottomSheetModal>
    );
});

DefaultModal.displayName = "DefaultModal";

export default DefaultModal;

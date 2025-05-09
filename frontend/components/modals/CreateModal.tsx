import { Dimensions, StyleSheet, View } from "react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useThemeColor } from "@/hooks/useThemeColor";
import ModalHead from "./ModalHead";
import Standard from "./create/Standard";
import ConditionalView from "../ui/ConditionalView";
import NewCategory from "./create/NewCategory";
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";

type Props = {
    visible: boolean;
    setVisible: (visible: boolean) => void;
    edit?: boolean;
    focused?: string;
    setFocused?: (focused: string) => void;
};

export enum Screen {
    STANDARD,
    NEW_CATEGORY,
    EDIT,
    DEADLINE,
    RECURRING,
    STARTDATE,
    STARTTIME,
}

const CreateModal = (props: Props) => {
    const [screen, setScreen] = useState(Screen.STANDARD);
    const ThemedColor = useThemeColor();

    // Reference to the bottom sheet modal
    const bottomSheetModalRef = useRef<BottomSheetModal>(null);

    // Define snap points - we'll use percentages for flexibility
    const snapPoints = useMemo(() => ["60%", "75%"], []);

    // Handle visibility changes
    useEffect(() => {
        if (props.visible) {
            try {
                bottomSheetModalRef.current?.present();
            } catch (error) {
                console.log("Error presenting bottom sheet:", error);
            }
        } else {
            try {
                bottomSheetModalRef.current?.dismiss();
            } catch (error) {
                console.log("Error dismissing bottom sheet:", error);
            }
        }
    }, [props.visible]);

    // Handle sheet changes
    const handleSheetChanges = useCallback(
        (index: number) => {
            if (index === -1 && props.visible) {
                props.setVisible(false);
            }
        },
        [props.visible, props.setVisible]
    );

    // Reset screen when modal is dismissed
    useEffect(() => {
        if (!props.visible) {
            // Reset to standard screen when modal is closed
            // Using a small delay to ensure the animation completes first
            const timer = setTimeout(() => setScreen(Screen.STANDARD), 300);
            return () => clearTimeout(timer);
        }
    }, [props.visible]);

    // Custom backdrop component
    const renderBackdrop = useCallback(
        (backdropProps) => (
            <BottomSheetBackdrop {...backdropProps} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
        ),
        []
    );

    return (
        <BottomSheetModal
            ref={bottomSheetModalRef}
            index={0}
            snapPoints={snapPoints}
            onChange={handleSheetChanges}
            keyboardBehavior="interactive"
            backdropComponent={renderBackdrop}
            handleIndicatorStyle={{ backgroundColor: ThemedColor.text }}
            backgroundStyle={{ backgroundColor: ThemedColor.background }}
            enablePanDownToClose={true}>
            <BottomSheetView style={[styles.container, { backgroundColor: ThemedColor.background }]}>
                <ConditionalView condition={screen === Screen.STANDARD}>
                    <Standard hide={() => props.setVisible(false)} goTo={setScreen} />
                </ConditionalView>
                <ConditionalView condition={screen === Screen.NEW_CATEGORY}>
                    <NewCategory goToStandard={() => setScreen(Screen.STANDARD)} />
                </ConditionalView>
            </BottomSheetView>
        </BottomSheetModal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 24,
        gap: 8,
        width: "100%",
    },
});

export default CreateModal;

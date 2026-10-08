import React, { useRef } from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { GearSix, Moon } from "phosphor-react-native";
import { setFocusButtonRect } from "@/hooks/useFocusButtonRect";

interface WelcomeHeaderProps {
    ThemedColor: any;
    onSettingsPress: () => void;
    focusMode: boolean;
    onToggleFocusMode: () => void;
}

// Home's top bar: focus mode + settings. The greeting itself lives in the focus stage.
export const WelcomeHeader: React.FC<WelcomeHeaderProps> = ({ ThemedColor, onSettingsPress, focusMode, onToggleFocusMode }) => {
    const focusBtnRef = useRef<View>(null);
    // Publish where the moon button sits so the intro tour can point at it
    const publishFocusRect = () => {
        focusBtnRef.current?.measureInWindow((x, y, width, height) => {
            if (width > 0) setFocusButtonRect({ x, y, width, height });
        });
    };

    return (
        <View style={styles.actions}>
            <TouchableOpacity
                ref={focusBtnRef}
                onLayout={publishFocusRect}
                onPress={onToggleFocusMode}
                hitSlop={8}
                activeOpacity={0.7}
                accessibilityLabel="Focus mode"
                style={styles.btn}>
                <Moon size={22} color={focusMode ? ThemedColor.primary : ThemedColor.caption} weight={focusMode ? "fill" : "regular"} />
            </TouchableOpacity>
            <TouchableOpacity onPress={onSettingsPress} hitSlop={8} activeOpacity={0.7} accessibilityLabel="Settings" style={styles.btn}>
                <GearSix size={22} color={ThemedColor.caption} />
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    actions: {
        flexDirection: "row",
        justifyContent: "flex-end",
        alignItems: "center",
        gap: 10,
        paddingTop: 12,
        paddingBottom: 4,
    },
    btn: { padding: 4 },
});

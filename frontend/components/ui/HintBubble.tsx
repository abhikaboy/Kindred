import React, { useEffect, useRef } from "react";
import { TouchableOpacity, StyleSheet, ViewStyle, StyleProp } from "react-native";
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";
import { Sparkle } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";

type Props = {
    text: string;
    onDone: () => void;
    autoDismissMs?: number;
    style?: StyleProp<ViewStyle>;
};

/** One-line first-touch hint pill; dismisses on tap or after a timeout. */
const HintBubble = ({ text, onDone, autoDismissMs = 5000, style }: Props) => {
    const ThemedColor = useThemeColor();
    const dismissed = useRef(false);

    const dismiss = () => {
        if (dismissed.current) return;
        dismissed.current = true;
        onDone();
    };

    useEffect(() => {
        const t = setTimeout(dismiss, autoDismissMs);
        return () => clearTimeout(t);
    }, []);

    return (
        <Animated.View entering={FadeInDown.duration(250)} exiting={FadeOut.duration(150)} style={style}>
            <TouchableOpacity
                onPress={dismiss}
                activeOpacity={0.8}
                style={[
                    styles.pill,
                    { backgroundColor: ThemedColor.lightened, borderColor: ThemedColor.primary + "40" },
                ]}
            >
                <Sparkle size={14} weight="fill" color={ThemedColor.primary} />
                <ThemedText type="caption">{text}</ThemedText>
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    pill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        alignSelf: "flex-start",
        borderWidth: 1,
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 7,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
        elevation: 4,
    },
});

export default HintBubble;

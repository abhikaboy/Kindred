import React, { forwardRef } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import ConfettiCannon from "react-native-confetti-cannon";
import { useThemeColor } from "@/hooks/useThemeColor";

const { width, height } = Dimensions.get("screen");

// Brand-only burst for committing to a plan: purple, light purple, yellow, green
// and white. Never red. Starts on demand via ref.start().
const PlanConfetti = forwardRef<ConfettiCannon>((_, ref) => {
    const ThemedColor = useThemeColor();
    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <ConfettiCannon
                ref={ref}
                autoStart={false}
                count={110}
                origin={{ x: width / 2, y: height * 0.62 }}
                explosionSpeed={350}
                fallSpeed={1600}
                fadeOut
                colors={[ThemedColor.primary, "#B899FF", "#FFD66B", "#5FD68A", "#FFFFFF"]}
            />
        </View>
    );
});

PlanConfetti.displayName = "PlanConfetti";

export default PlanConfetti;

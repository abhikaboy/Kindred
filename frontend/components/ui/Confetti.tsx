import React, { forwardRef } from "react";
import { Dimensions } from "react-native";
import ConfettiCannon from "react-native-confetti-cannon";
import { hapticCompletionBurst } from "@/utils/haptics";

const { width, height } = Dimensions.get("screen");

type Props = Partial<React.ComponentProps<typeof ConfettiCannon>>;

// The canonical celebration — the task-completion cannon. Every burst in the app
// uses this charge so confetti feels consistent everywhere — including the haptic.
const Confetti = forwardRef<ConfettiCannon, Props>(({ onAnimationStart, ...props }, ref) => (
    <ConfettiCannon
        ref={ref}
        count={50}
        origin={{ x: width / 2, y: (height / 4) * 3.7 }}
        fallSpeed={1200}
        explosionSpeed={300}
        fadeOut
        onAnimationStart={(...args) => {
            hapticCompletionBurst();
            onAnimationStart?.(...args);
        }}
        {...props}
    />
));

export default Confetti;

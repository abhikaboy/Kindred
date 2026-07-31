import React, { useEffect, useRef } from 'react';
import { View, Animated as RNAnimated } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { RING_COLORS } from '@shared/rings';

const AnimatedCircle = RNAnimated.createAnimatedComponent(Circle);

const SIZE = 168;
const STROKE = 14;
const GAP = 6;
const CENTER = SIZE / 2;
const DURATION = 900;
const STAGGER = 220;

// Three concentric rings in the plan/do/share colors, drawn outer to inner.
const RINGS = [
    { color: RING_COLORS.plan, radius: (SIZE - STROKE) / 2 },
    { color: RING_COLORS.do, radius: (SIZE - STROKE) / 2 - (STROKE + GAP) },
    { color: RING_COLORS.share, radius: (SIZE - STROKE) / 2 - 2 * (STROKE + GAP) },
];

interface RingsFillHeroProps {
    /** When true, (re)plays the staggered fill from empty. */
    play: boolean;
    /** Fires once after the last ring finishes filling. */
    onComplete?: () => void;
}

/** Animated activity-rings illustration: each ring fills on a staggered delay. */
export const RingsFillHero: React.FC<RingsFillHeroProps> = ({ play, onComplete }) => {
    const values = useRef(RINGS.map(() => new RNAnimated.Value(0))).current;

    useEffect(() => {
        values.forEach((v) => v.setValue(0));
        if (!play) return;

        const animations = values.map((v, i) =>
            RNAnimated.timing(v, {
                toValue: 1,
                duration: DURATION,
                delay: i * STAGGER,
                useNativeDriver: false,
            })
        );
        RNAnimated.parallel(animations).start(({ finished }) => {
            if (finished) onComplete?.();
        });
        // onComplete intentionally excluded — replays are driven by `play`.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [play]);

    return (
        <View style={{ height: 180, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={SIZE} height={SIZE}>
                {RINGS.map((ring, i) => {
                    const circumference = 2 * Math.PI * ring.radius;
                    const strokeDashoffset = values[i].interpolate({
                        inputRange: [0, 1],
                        outputRange: [circumference, 0],
                    });
                    return (
                        <React.Fragment key={ring.color}>
                            <Circle
                                cx={CENTER}
                                cy={CENTER}
                                r={ring.radius}
                                stroke={ring.color + '22'}
                                strokeWidth={STROKE}
                                fill="none"
                            />
                            <AnimatedCircle
                                cx={CENTER}
                                cy={CENTER}
                                r={ring.radius}
                                stroke={ring.color}
                                strokeWidth={STROKE}
                                fill="none"
                                strokeDasharray={`${circumference}`}
                                strokeDashoffset={strokeDashoffset}
                                strokeLinecap="round"
                                rotation={-90}
                                origin={`${CENTER}, ${CENTER}`}
                            />
                        </React.Fragment>
                    );
                })}
            </Svg>
        </View>
    );
};

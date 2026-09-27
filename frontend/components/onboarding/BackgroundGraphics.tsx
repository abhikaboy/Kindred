import React, { useEffect, useRef } from 'react';
import { View, Dimensions, Animated, StyleSheet } from 'react-native';
import Svg, { Circle, Path, G } from 'react-native-svg';
import { useThemeColor } from '@/hooks/useThemeColor';

// Create animated versions of SVG components
const AnimatedG = Animated.createAnimatedComponent(G);

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface OnboardingBackgroundProps {
  variant?: 'default' | 'green';
}

// Main background graphics layout component - matching new design
export const OnboardingBackground = ({ variant = 'default' }: OnboardingBackgroundProps = {}) => {
  const ThemedColor = useThemeColor();

  // Reference dimensions based on SVG viewBox (402x846)
  const referenceWidth = 402;
  const referenceHeight = 846;

  // Scale factors for responsive design
  const scaleX = screenWidth / referenceWidth;
  const scaleY = screenHeight / referenceHeight;
  const scale = Math.min(scaleX, scaleY);

  // Individual animations for each element to create drift effect
  const circle1Anim = useRef(new Animated.Value(0)).current; // Bottom left large circle
  const circle3Anim = useRef(new Animated.Value(0)).current; // Top right large circle
  const triangleAnim = useRef(new Animated.Value(0)).current; // Triangle shape

  useEffect(() => {
    // Bottom left large circle - slow and gentle
    const circle1Loop = Animated.loop(
      Animated.sequence([
        Animated.timing(circle1Anim, {
          toValue: 1,
          duration: 12000,
          useNativeDriver: false, // Must be false for SVG transforms
        }),
        Animated.timing(circle1Anim, {
          toValue: 0,
          duration: 12000,
          useNativeDriver: false,
        }),
      ])
    );


    // Top right large circle - slow with different phase
    const circle3Loop = Animated.loop(
      Animated.sequence([
        Animated.timing(circle3Anim, {
          toValue: 1,
          duration: 13500,
          useNativeDriver: false,
        }),
        Animated.timing(circle3Anim, {
          toValue: 0,
          duration: 13500,
          useNativeDriver: false,
        }),
      ])
    );


    // Triangle - faster with rotation
    const triangleLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(triangleAnim, {
          toValue: 1,
          duration: 11000,
          useNativeDriver: false,
        }),
        Animated.timing(triangleAnim, {
          toValue: 0,
          duration: 11000,
          useNativeDriver: false,
        }),
      ])
    );


    circle1Loop.start();
    circle3Loop.start();
    triangleLoop.start();

    return () => {
      circle1Loop.stop();
      circle3Loop.stop();
      triangleLoop.stop();
    };
  }, []);

  // Create transform strings that work with AnimatedG
  // Slower rotations and proper center points
  const circle1Transform = circle1Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      'translate(0, 0) rotate(0 58 746)',
      'translate(15, -25) rotate(180 58 746)' // Reduced from 360 to 180
    ],
  });

  const circle3Transform = circle3Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      'translate(0, 0) rotate(0 371 -27)',
      'translate(-18, 22) rotate(180 371 -27)' // Reduced from 360 to 180
    ],
  });

  const triangleTransform = triangleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      'translate(0, 0) rotate(0 336 283)', // Fixed center point to actual triangle center
      'translate(20, -30) rotate(20 336 283)' // Reduced from 45 to 20 degrees
    ],
  });

  // Determine color based on variant using themed colors
  const strokeColor = variant === 'green' ? ThemedColor.success : ThemedColor.primary;

  return (
    <View style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 0,
    }}>
      <Svg
        width={screenWidth}
        height={screenHeight}
        viewBox="0 0 402 950"
        style={{ position: 'absolute' }}
      >
        {/* Bottom left large dashed circle */}
        <AnimatedG transform={circle1Transform}>
          <Circle
            cx="58"
            cy="746"
            r="55.5"
            fill="none"
            stroke={strokeColor}
            strokeDasharray="20 20"
            strokeWidth="1"
            strokeOpacity={0.45}
          />
        </AnimatedG>

        {/* Top right large dashed circle (partially outside viewbox) */}
        <AnimatedG transform={circle3Transform}>
          <Circle
            cx="371"
            cy="-27"
            r="85.5"
            fill="none"
            stroke={strokeColor}
            strokeDasharray="20 20"
            strokeWidth="1"
            strokeOpacity={0.45}
          />
        </AnimatedG>

        {/* Upper right outlined triangle - only show for default variant */}
        {variant === 'default' && (
          <AnimatedG transform={triangleTransform}>
            <G transform="translate(300, 252) rotate(-5.685) scale(0.6)">
              <Path
                d="M35.16 9.74C36.12 7.69 38.92 7.41 40.28 9.23L76.84 58.41C78.23 60.28 77.05 62.95 74.73 63.19L12.02 69.43C9.70 69.66 8.01 67.27 9.01 65.16L35.16 9.74Z"
                fill="none"
                stroke={strokeColor}
                strokeWidth={1.6}
                strokeOpacity={0.4}
                strokeLinejoin="round"
              />
            </G>
          </AnimatedG>
        )}

      </Svg>
    </View>
  );
};

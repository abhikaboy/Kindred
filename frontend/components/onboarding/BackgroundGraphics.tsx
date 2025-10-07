import React, { useEffect, useRef } from 'react';
import { View, Dimensions, Animated, StyleSheet } from 'react-native';
import Svg, { Circle, Path, G } from 'react-native-svg';

// Create animated versions of SVG components
const AnimatedG = Animated.createAnimatedComponent(G);

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface OnboardingBackgroundProps {
  variant?: 'default' | 'green';
}

// Main background graphics layout component - matching new design
export const OnboardingBackground = ({ variant = 'default' }: OnboardingBackgroundProps = {}) => {
  // Reference dimensions based on SVG viewBox (402x846)
  const referenceWidth = 402;
  const referenceHeight = 846;
  
  // Scale factors for responsive design
  const scaleX = screenWidth / referenceWidth;
  const scaleY = screenHeight / referenceHeight;
  const scale = Math.min(scaleX, scaleY);

  // Individual animations for each element to create drift effect
  const circle1Anim = useRef(new Animated.Value(0)).current; // Bottom left large circle
  const circle2Anim = useRef(new Animated.Value(0)).current; // Top left small circle
  const circle3Anim = useRef(new Animated.Value(0)).current; // Top right large circle
  const pathAnim = useRef(new Animated.Value(0)).current; // Complex geometric path
  const triangleAnim = useRef(new Animated.Value(0)).current; // Triangle shape
  const diamondAnim = useRef(new Animated.Value(0)).current; // Diamond shape

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

    // Top left small circle - medium speed
    const circle2Loop = Animated.loop(
      Animated.sequence([
        Animated.timing(circle2Anim, {
          toValue: 1,
          duration: 8500,
          useNativeDriver: false,
        }),
        Animated.timing(circle2Anim, {
          toValue: 0,
          duration: 8500,
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

    // Complex path - moderate speed
    const pathLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pathAnim, {
          toValue: 1,
          duration: 10000,
          useNativeDriver: false,
        }),
        Animated.timing(pathAnim, {
          toValue: 0,
          duration: 10000,
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

    // Diamond - fastest movement
    const diamondLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(diamondAnim, {
          toValue: 1,
          duration: 7000,
          useNativeDriver: false,
        }),
        Animated.timing(diamondAnim, {
          toValue: 0,
          duration: 7000,
          useNativeDriver: false,
        }),
      ])
    );

    circle1Loop.start();
    circle2Loop.start();
    circle3Loop.start();
    pathLoop.start();
    triangleLoop.start();
    diamondLoop.start();

    return () => {
      circle1Loop.stop();
      circle2Loop.stop();
      circle3Loop.stop();
      pathLoop.stop();
      triangleLoop.stop();
      diamondLoop.stop();
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

  const circle2Transform = circle2Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      'translate(0, 0) rotate(0 18 123)',
      'translate(-12, -20) rotate(180 18 123)' // Reduced from 360 to 180
    ],
  });

  const circle3Transform = circle3Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      'translate(0, 0) rotate(0 371 -27)',
      'translate(-18, 22) rotate(180 371 -27)' // Reduced from 360 to 180
    ],
  });

  const pathTransform = pathAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      'translate(0, 0) rotate(0 305 591)',
      'translate(10, -16) rotate(180 305 591)' // Reduced from 360 to 180
    ],
  });

  const triangleTransform = triangleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      'translate(0, 0) rotate(0 336 283)', // Fixed center point to actual triangle center
      'translate(20, -30) rotate(20 336 283)' // Reduced from 45 to 20 degrees
    ],
  });

  const diamondTransform = diamondAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      'translate(0, 0) rotate(0 329 898)',
      'translate(-25, 35) rotate(-30 329 898)' // Reduced from -60 to -30
    ],
  });

  // Determine color based on variant
  const strokeColor = variant === 'green' ? '#5CFF95' : '#854DFF';
  const fillColor = variant === 'green' ? '#5CFF95' : '#854DFF';

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
            r="85.5" 
            fill="white" 
            stroke={strokeColor} 
            strokeDasharray="20 20"
            strokeWidth="1"
          />
        </AnimatedG>
        
        {/* Top left small dashed circle */}
        <AnimatedG transform={circle2Transform}>
          <Circle 
            cx="18" 
            cy="123" 
            r="55.5" 
            fill="white" 
            stroke={strokeColor} 
            strokeDasharray="20 20"
            strokeWidth="1"
          />
        </AnimatedG>
        
        {/* Complex geometric path with dashed stroke - only show for default variant */}
        {variant === 'default' && (
          <AnimatedG transform={pathTransform}>
            <Path 
              d="M322.847 593.901L322.666 602.739L322.665 602.74L322.165 602.729L321.983 611.568L322.483 611.578L322.483 611.577L322.301 620.416L321.801 620.406L321.71 624.825C321.694 625.586 321.46 626.242 321.087 626.77L321.493 627.055C320.567 628.368 318.888 629.014 317.321 628.662L317.43 628.177C316.878 628.053 316.339 627.786 315.863 627.35L315.663 627.153L312.632 623.936L312.269 624.278L306.206 617.845L306.57 617.502L300.508 611.069L300.144 611.411L300.143 611.411L294.082 604.977L294.446 604.635L288.383 598.201L288.02 598.544L288.019 598.543L281.957 592.11L281.957 592.111L282.322 591.767L279.29 588.55C279.081 588.328 278.849 588.128 278.6 587.953L278.345 587.787L274.563 585.498L274.304 585.926L266.741 581.349L267 580.922L259.438 576.345L259.178 576.772L251.616 572.196L251.875 571.769L244.312 567.192L244.052 567.618L236.49 563.042L236.748 562.615L232.967 560.327C232.316 559.933 231.866 559.402 231.595 558.815L231.143 559.022C230.47 557.564 230.75 555.787 231.839 554.606L232.203 554.943C232.587 554.528 233.088 554.195 233.703 554.001L233.975 553.926L238.276 552.909L238.161 552.422L246.764 550.388L246.764 550.39L246.878 550.876L255.482 548.843L255.366 548.357L255.366 548.355L263.97 546.323L264.085 546.81L272.687 544.777L272.572 544.29L281.175 542.256L281.176 542.257L281.29 542.743L285.592 541.727C285.988 541.633 286.37 541.486 286.726 541.29L290.598 539.159L290.357 538.721L298.102 534.459L298.102 534.46L298.344 534.898L306.088 530.637L305.847 530.199L305.847 530.197L313.593 525.937L313.833 526.376L321.579 522.114L321.338 521.676L329.082 517.414L329.082 517.415L329.323 517.853L333.196 515.722C333.863 515.355 334.548 515.231 335.192 515.29L335.236 514.793C336.836 514.939 338.236 516.071 338.714 517.604L338.239 517.752C338.432 518.369 338.454 519.065 338.235 519.794L336.964 524.028L337.444 524.172L337.444 524.171L334.903 532.637L334.903 532.638L334.424 532.495L331.884 540.962L332.362 541.105L329.823 549.572L329.822 549.573L329.343 549.429L326.803 557.895L327.281 558.04L327.282 558.039L324.74 566.506L324.741 566.506L324.262 566.363L322.992 570.596C322.875 570.986 322.811 571.39 322.803 571.796L322.712 576.216L323.211 576.226L323.212 576.225L323.029 585.063L323.03 585.064L322.529 585.054L322.347 593.892L322.847 593.901Z" 
              fill="white" 
              stroke={strokeColor} 
              strokeDasharray="8 8"
              strokeWidth="1"
            />
          </AnimatedG>
        )}
        
        {/* Top right large dashed circle (partially outside viewbox) */}
        <AnimatedG transform={circle3Transform}>
          <Circle 
            cx="371" 
            cy="-27" 
            r="85.5" 
            fill="white" 
            stroke={strokeColor} 
            strokeDasharray="20 20"
            strokeWidth="1"
          />
        </AnimatedG>
        
        {/* Upper right triangular shape - only show for default variant */}
        {variant === 'default' && (
          <AnimatedG transform={triangleTransform}>
            <G transform="translate(293, 247) rotate(-5.685)">
              <Path 
                d="M35.16 9.74C36.12 7.69 38.92 7.41 40.28 9.23L76.84 58.41C78.23 60.28 77.05 62.95 74.73 63.19L12.02 69.43C9.70 69.66 8.01 67.27 9.01 65.16L35.16 9.74Z" 
                fill={fillColor}
              />
            </G>
          </AnimatedG>
        )}
        
        {/* Lower right diamond shape - only show for default variant */}
        {variant === 'default' && (
          <AnimatedG transform={diamondTransform}>
            <G transform="translate(301, 870) rotate(31.074)">
              <Path 
                d="M28 5L50 28L28 51L6 28Z" 
                fill={fillColor}
              />
            </G>
          </AnimatedG>
        )}
      </Svg>
    </View>
  );
};

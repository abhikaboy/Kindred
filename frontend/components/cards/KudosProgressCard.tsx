import React, { useEffect, useRef } from "react";
import { View, StyleSheet, TouchableOpacity, Animated } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { router } from "expo-router";
import { KUDOS_CONSTANTS } from "@/constants/kudos";

interface KudosProgressCardProps {
  current: number;
  max?: number;
  type: "encouragements" | "congratulations";
  description?: string;
  showNavigation?: boolean;
}

export default function KudosProgressCard({ 
  current, 
  max = KUDOS_CONSTANTS.ENCOURAGEMENTS_MAX, 
  type,
  description,
  showNavigation = true
}: KudosProgressCardProps) {
  const ThemedColor = useThemeColor();
  const progress = Math.min(current / max, 1);
  const isMaxed = current >= max;

  // Animated value for progress bar
  const animatedWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animate progress bar on mount
    Animated.timing(animatedWidth, {
      toValue: progress,
      duration: 1000,
      useNativeDriver: false,
      easing: (t: number) => t * t, // Ease in (quadratic)
    }).start();
  }, [progress]);

  const defaultDescription = `Send more ${type} to unlock rewards and features within Kindred`;

  const handlePress = () => {
    router.push("/(logged-in)/kudos-rewards");
  };

  const styles = createStyles(ThemedColor, isMaxed);

  // Interpolate animated value to percentage string
  const animatedWidthStyle = animatedWidth.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={styles.container}>
      <ThemedText type="caption">
        {description || defaultDescription}
      </ThemedText>

      <View style={styles.progressSection}>
        {/* Progress Bar */}
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBarBackground}>
            <Animated.View 
              style={[
                styles.progressBarFill,
                { width: animatedWidthStyle }
              ]} 
            />
          </View>
        </View>

        {/* Progress Text and Button */}
        <View style={styles.textRow}>
          <ThemedText type="caption" style={styles.progressText}>
            {current}/{max}
          </ThemedText>
          {showNavigation && (
            <TouchableOpacity onPress={handlePress} activeOpacity={0.7}>
              <ThemedText type="caption" style={styles.rewardsButton}>
                {isMaxed ? "CLAIM REWARDS" : "SEE REWARDS"} →
              </ThemedText>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const createStyles = (ThemedColor: ReturnType<typeof useThemeColor>, isMaxed: boolean) =>
  StyleSheet.create({
    container: {
      flexDirection: "column",
      gap: 16,
      width: "100%",
      paddingVertical: 12,
    },
    description: {
      fontSize: 14,
      color: ThemedColor.caption,
      lineHeight: 20,
    },
    progressSection: {
      flexDirection: "column",
      gap: 12,
      alignItems: "center",
      width: "100%",
    },
    progressBarContainer: {
      width: "100%",
    },
    progressBarBackground: {
      height: 8,
      backgroundColor: ThemedColor.tertiary,
      borderRadius: 4,
      overflow: "hidden",
    },
    progressBarFill: {
      height: "100%",
      backgroundColor: ThemedColor.primary,
      borderRadius: 4,
    },
    textRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      width: "100%",
    },
    progressText: {
      fontSize: 14,
      color: ThemedColor.primary,
    },
    rewardsButton: {
      fontSize: 14,
      color: isMaxed ? ThemedColor.primary : ThemedColor.caption,
      fontWeight: isMaxed ? "600" : "400",
    },
  });


import React, { useEffect, useRef } from "react";
import { View, StyleSheet, TouchableOpacity, Animated } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { router } from "expo-router";
import { KUDOS_CONSTANTS } from "@/constants/kudos";
import { Sparkle, Confetti, ArrowRight } from "phosphor-react-native";

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

  const animatedWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedWidth, {
      toValue: progress,
      duration: 1000,
      useNativeDriver: false,
      easing: (t: number) => t * t,
    }).start();
  }, [progress]);

  const defaultDescription = `Send more ${type} to unlock Kindred features`;

  const handlePress = () => {
    router.push("/(logged-in)/kudos-rewards");
  };

  const styles = createStyles(ThemedColor, isMaxed);

  const animatedWidthStyle = animatedWidth.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  const icon = type === "encouragements" 
    ? <Sparkle size={18} weight="fill" color={ThemedColor.primary} /> 
    : <Confetti size={18} weight="fill" color={ThemedColor.primary} />;

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.labelRow}>
          {icon}
          <ThemedText type="defaultSemiBold" style={styles.labelText}>
            {current}/{max} sent
          </ThemedText>
        </View>
        {showNavigation && (
          <TouchableOpacity onPress={handlePress} activeOpacity={0.7} style={styles.rewardsButton}>
            <ThemedText type="caption" style={styles.rewardsText}>
              {isMaxed ? "Claim rewards" : "See rewards"}
            </ThemedText>
            <ArrowRight size={12} weight="bold" color={isMaxed ? ThemedColor.primary : ThemedColor.caption} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.progressBarBackground}>
        <Animated.View 
          style={[
            styles.progressBarFill,
            { width: animatedWidthStyle }
          ]} 
        />
      </View>

      <ThemedText type="caption" style={styles.description}>
        {description || defaultDescription}
      </ThemedText>
    </View>
  );
}

const createStyles = (ThemedColor: ReturnType<typeof useThemeColor>, isMaxed: boolean) =>
  StyleSheet.create({
    card: {
      borderRadius: 16,
      padding: 16,
      gap: 12,
      borderColor: ThemedColor.tertiary,
      boxShadow: ThemedColor.shadowSmall,
    },
    topRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    labelRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    labelText: {
      fontSize: 15,
      color: ThemedColor.text,
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
    description: {
      fontSize: 13,
      color: ThemedColor.caption,
      lineHeight: 18,
    },
    rewardsButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    rewardsText: {
      fontSize: 13,
      color: isMaxed ? ThemedColor.primary : ThemedColor.caption,
      fontWeight: isMaxed ? "600" : "400",
    },
  });


import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet } from "react-native";
import { useAuth } from "@/hooks/useAuth";
import { useThemeColor } from "@/hooks/useThemeColor";

// Matches EncouragerAvatars' avatar treatment (22px, 1.5 ring).
const SIZE = 22;

// The sender's own avatar fading in/out on the kudos task preview —
// a live hint of where their kudos will appear once sent.
const KudosPreviewAvatar = () => {
    const { user } = useAuth();
    const ThemedColor = useThemeColor();
    const opacity = useRef(new Animated.Value(0.35)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, { toValue: 1, duration: 1200, useNativeDriver: true }),
                Animated.timing(opacity, { toValue: 0.35, duration: 1200, useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [opacity]);

    if (!user?.profile_picture) return null;

    return (
        <Animated.Image
            source={{ uri: user.profile_picture }}
            style={[styles.avatar, { borderColor: ThemedColor.lightened, opacity }]}
        />
    );
};

const styles = StyleSheet.create({
    avatar: {
        width: SIZE,
        height: SIZE,
        borderRadius: SIZE / 2,
        borderWidth: 1.5,
    },
});

export default KudosPreviewAvatar;

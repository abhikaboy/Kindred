import React from "react";
import { View } from "react-native";
import { User } from "phosphor-react-native";
import CachedImage from "@/components/CachedImage";
import { useAuth } from "@/hooks/useAuth";
import { useThemeColor } from "@/hooks/useThemeColor";

// Profile tab icon: shows the user's avatar with a ring when focused,
// falling back to the Phosphor User icon when there's no picture.
export function ProfileTabIcon({ focused, color, size = 24 }: { focused: boolean; color: string; size?: number }) {
    const { user } = useAuth();
    const ThemedColor = useThemeColor();
    const uri = user?.profile_picture;

    if (!uri) {
        return <User size={size} color={color} weight={focused ? "fill" : "regular"} />;
    }

    const dim = size + 4;
    return (
        <View
            style={{
                width: dim,
                height: dim,
                borderRadius: dim / 2,
                borderWidth: focused ? 2 : 1,
                borderColor: focused ? ThemedColor.primary : ThemedColor.tertiary,
                overflow: "hidden",
            }}>
            <CachedImage
                source={{ uri }}
                style={{ width: "100%", height: "100%" }}
                variant="thumbnail"
                cachePolicy="memory-disk"
            />
        </View>
    );
}

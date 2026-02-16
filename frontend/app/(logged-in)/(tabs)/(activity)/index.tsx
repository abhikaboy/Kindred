import { Redirect } from "expo-router";
import { useAuth } from "@/hooks/useAuth";
import { View, ActivityIndicator } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";

export default function ActivityIndex() {
    const { user } = useAuth();
    const ThemedColor = useThemeColor();

    // Show loading while user data is being fetched
    if (!user) {
        return (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: ThemedColor.background }}>
                <ActivityIndicator size="large" color={ThemedColor.primary} />
            </View>
        );
    }

    // Redirect to the user's activity page
    return <Redirect href={`/(activity)/${user._id}`} />;
}

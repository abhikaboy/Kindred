import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { useThemeColor } from "@/hooks/useThemeColor";
import { getAuthData, useOptionalAuth } from "@/hooks/useAuth";
import { savePendingOAuthRequest } from "@/hooks/useAssistantConnections";
import { HORIZONTAL_PADDING } from "@/constants/spacing";

/**
 * Deep-link entry for kindred://oauth/approve?request=<id>.
 * Lives outside (logged-in) so a signed-out user isn't bounced into guest setup;
 * signed-in users go straight on to the consent screen.
 */
export default function OAuthApproveLink() {
    const ThemedColor = useThemeColor();
    const insets = useSafeAreaInsets();
    const auth = useOptionalAuth();
    const { request } = useLocalSearchParams<{ request?: string }>();
    const [needsLogin, setNeedsLogin] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const route = async () => {
            const toConsent = () => router.replace({ pathname: "/oauth/consent", params: request ? { request } : {} });

            const current = auth?.user;
            if (current && !current.isGuest) return toConsent();
            if (current?.isGuest || !(await getAuthData()) || !auth) {
                if (!cancelled) setNeedsLogin(true);
                return;
            }
            const result = await auth.fetchAuthData();
            if (cancelled) return;
            const user = result.status === "unauthenticated" ? null : result.user;
            // Offline with a real session: let the consent screen report the network problem
            if (user && !user.isGuest) return toConsent();
            if (result.status === "unverified-offline" && !user) return toConsent();
            setNeedsLogin(true);
        };
        void route();
        return () => {
            cancelled = true;
        };
    }, [request]);

    const logIn = async () => {
        if (request) await savePendingOAuthRequest(request);
        router.replace({ pathname: "/login", params: { mode: "login" } });
    };

    const close = () => (router.canGoBack() ? router.back() : router.replace("/"));

    return (
        <View style={[styles.container, { backgroundColor: ThemedColor.background, paddingTop: insets.top + 8 }]}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={close}
                    style={styles.closeButton}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Close">
                    <X size={24} color={ThemedColor.text} weight="bold" />
                </TouchableOpacity>
            </View>
            {needsLogin ? (
                <Animated.View entering={FadeIn.duration(200)} style={styles.flex}>
                    <View style={styles.body}>
                        <ThemedText type="fancyFrauncesSubheading">Log in to connect your assistant</ThemedText>
                        <ThemedText type="default">
                            Your assistant is asking to connect to your Kindred account. Log in and you'll come right
                            back here to approve it.
                        </ThemedText>
                    </View>
                    <View style={[styles.actions, { paddingBottom: insets.bottom + 16 }]}>
                        <PrimaryButton title="Log in" onPress={logIn} />
                    </View>
                </Animated.View>
            ) : (
                <View style={styles.center}>
                    <ActivityIndicator color={ThemedColor.caption} />
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    flex: {
        flex: 1,
    },
    header: {
        paddingHorizontal: HORIZONTAL_PADDING - 8,
        paddingBottom: 8,
        alignItems: "flex-start",
    },
    closeButton: {
        padding: 8,
    },
    center: {
        paddingTop: 48,
        alignItems: "center",
    },
    body: {
        flex: 1,
        paddingHorizontal: HORIZONTAL_PADDING,
        paddingTop: 16,
        gap: 4,
    },
    actions: {
        paddingHorizontal: HORIZONTAL_PADDING,
        paddingTop: 12,
    },
});

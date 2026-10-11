import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { reloadAppAsync } from "expo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { HORIZONTAL_PADDING } from "@/constants/spacing";
import { useAuth } from "@/hooks/useAuth";
import { clearLessonState } from "@/utils/postingLesson/storage";
import { forcePostingLessonOnNextCompletion } from "@/utils/postingLesson/devForce";
import { startPostingLessonDemo } from "@/utils/postingLesson/demo";
import {
    getOnboardingDebugSnapshot,
    ONBOARDING_V2_STEP_LABELS,
    OnboardingDebugSnapshot,
    quickSetupKey,
    resetOnboardingState,
    setOnboardingV2Step,
} from "@/utils/devOnboarding";

// Dev-only: kindred:///dev-onboarding (or `xcrun simctl openurl booted kindred:///dev-onboarding`).
// Reload after a reset or step jump so the app's in-memory tour state picks it up.
const yn = (v: boolean | null) => (v === null ? "-" : v ? "yes" : "no");

export default function DevOnboardingScreen() {
    const { user } = useAuth();
    // kindred:///dev-onboarding?jump=4 jumps to a step and reloads the app (scripted testing)
    const params = useLocalSearchParams<{ jump?: string; demo?: string; quiet?: string }>();
    const demoRan = React.useRef(false);
    const autoRan = React.useRef(false);
    const insets = useSafeAreaInsets();
    const userId = user?._id ?? null;
    const [snapshot, setSnapshot] = useState<OnboardingDebugSnapshot | null>(null);
    const [result, setResult] = useState("");

    const refresh = useCallback(async () => {
        setSnapshot(await getOnboardingDebugSnapshot(userId ?? undefined));
    }, [userId]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const run = async (label: string, action: () => Promise<unknown>) => {
        try {
            await action();
            setResult(label);
        } catch (e) {
            setResult(`${label} failed: ${(e as Error)?.message ?? e}`);
        }
        await refresh();
    };

    useEffect(() => {
        if (!__DEV__ || autoRan.current || !userId || params.jump === undefined) return;
        autoRan.current = true;
        void (async () => {
            await setOnboardingV2Step(userId, Number(params.jump));
            // quiet=1 also marks the legacy tours as seen, so a scripted demo isn't covered by them
            if (params.quiet === "1") {
                await AsyncStorage.multiSet([
                    [`${userId}-intro-tour-seen`, "true"],
                    [`${userId}-home-tour-seen`, "true"],
                    [quickSetupKey(userId), "true"],
                ]);
            }
            await reloadAppAsync("Onboarding dev jump");
        })();
    }, [userId, params.jump]);

    // kindred:///dev-onboarding?demo=toast|camera|caption|post starts the posting lesson at that step
    useEffect(() => {
        if (!__DEV__ || demoRan.current || !params.demo) return;
        demoRan.current = true;
        const step = params.demo as "toast" | "camera" | "caption" | "post";
        router.replace("/(logged-in)/(tabs)/(task)");
        setTimeout(() => startPostingLessonDemo(step), 1200);
    }, [params.demo]);

    if (!__DEV__) return <Redirect href="/" />;

    const rows: [string, string][] = snapshot
        ? [
              ["User", snapshot.userId ?? "signed out"],
              ["Home tour seen", yn(snapshot.homeTourSeen)],
              ["Intro tour seen", yn(snapshot.introTourSeen)],
              ["Quick setup done", yn(snapshot.quickSetupDone)],
              ["Guest tutorial done", yn(snapshot.guestTutorialDone)],
              ["v2 step", snapshot.onboardingV2Step === null ? "-" : `${snapshot.onboardingV2Step} ${ONBOARDING_V2_STEP_LABELS[snapshot.onboardingV2Step]}`],
              ["Has ever signed in", yn(snapshot.hasEverSignedIn)],
              ["Guest install", yn(snapshot.guestInstall)],
          ]
        : [];

    return (
        <ThemedView style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}>
                <ThemedText type="titleFraunces">Onboarding dev</ThemedText>
                <ThemedText type="caption">Dev builds only. Changes take effect after reload.</ThemedText>

                <View style={styles.section}>
                    {rows.map(([label, value]) => (
                        <View key={label} style={styles.row}>
                            <ThemedText type="default">{label}</ThemedText>
                            <ThemedText type="caption">{value}</ThemedText>
                        </View>
                    ))}
                </View>

                <View style={styles.section}>
                    <PrimaryButton
                        title={userId ? "Reset onboarding state" : "Reset all users' onboarding state"}
                        onPress={() => void run("Onboarding state reset", () => resetOnboardingState(userId ?? undefined))}
                    />
                    <PrimaryButton
                        title="Reload app"
                        ghost
                        onPress={() => void reloadAppAsync("Onboarding dev")}
                    />
                </View>

                <View style={styles.section}>
                    <ThemedText type="caption">Posting lesson</ThemedText>
                    <PrimaryButton
                        title="Reset posting lesson"
                        outline
                        disabled={!userId}
                        onPress={() => void run("Posting lesson reset", () => clearLessonState(userId!))}
                    />
                    <PrimaryButton
                        title="Show it on my next completion"
                        outline
                        onPress={() => void run("Posting lesson will show on the next completion", async () => forcePostingLessonOnNextCompletion(true))}
                    />
                </View>

                <View style={styles.section}>
                    <ThemedText type="caption">Jump to step</ThemedText>
                    {ONBOARDING_V2_STEP_LABELS.map((label, step) => (
                        <PrimaryButton
                            key={step}
                            title={`${step}. ${label}`}
                            outline
                            disabled={!userId}
                            onPress={() => void run(`Jumped to step ${step}`, () => setOnboardingV2Step(userId!, step))}
                        />
                    ))}
                </View>

                {result ? <ThemedText type="caption">{result}</ThemedText> : null}
            </ScrollView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    content: { paddingHorizontal: HORIZONTAL_PADDING, gap: 24 },
    section: { gap: 8 },
    row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
});

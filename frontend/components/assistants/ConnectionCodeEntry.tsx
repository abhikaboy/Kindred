import React, { useState } from "react";
import { TouchableOpacity, View, StyleSheet, useColorScheme } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Keyboard } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import ThemedInput from "@/components/inputs/ThemedInput";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { useThemeColor } from "@/hooks/useThemeColor";
import { errorStatus, getOAuthRequestByCodeAPI } from "@/api/oauth";
import { formatConnectionCode, parseConnectionCode } from "@/utils/assistantConnections";
import { oauthRequestKey } from "@/hooks/useAssistantConnections";

type Props = { initiallyOpen?: boolean };

function lookupErrorMessage(error: unknown): string {
    const status = errorStatus(error);
    if (status === 429) return "Too many tries. Wait a minute, then try again.";
    if (status === 404 || status === 400)
        return "No request matches that code. Check the code in your browser and try again.";
    if (status === 410) return "That code has expired. Start the connection again from your assistant.";
    return "Couldn't check that code. Something went wrong on our end. Give it another try.";
}

/** "Enter a connection code" row that opens into a code field and hands off to the consent screen. */
export default function ConnectionCodeEntry({ initiallyOpen = false }: Props) {
    const ThemedColor = useThemeColor();
    const scheme = useColorScheme();
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(initiallyOpen);
    const [code, setCode] = useState("");
    const [looking, setLooking] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const canonical = parseConnectionCode(code);

    const submit = async () => {
        if (!canonical || looking) return;
        setLooking(true);
        setError(null);
        try {
            const request = await getOAuthRequestByCodeAPI(canonical);
            queryClient.setQueryData(oauthRequestKey(request.id), request);
            setCode("");
            setOpen(false);
            router.push({ pathname: "/oauth/consent", params: { request: request.id } });
        } catch (e) {
            setError(lookupErrorMessage(e));
        } finally {
            setLooking(false);
        }
    };

    if (!open) {
        return (
            <TouchableOpacity
                style={styles.row}
                onPress={() => setOpen(true)}
                accessibilityRole="button"
                activeOpacity={0.7}>
                <View style={styles.lead}>
                    <Keyboard size={20} color={ThemedColor.primary} />
                </View>
                <ThemedText type="default" style={{ color: ThemedColor.primary }}>
                    Enter a connection code
                </ThemedText>
            </TouchableOpacity>
        );
    }

    // Light mode reads like an empty task row; dark mode keeps the raised surface
    const inputSurface =
        scheme === "dark"
            ? { backgroundColor: ThemedColor.lightened, borderColor: ThemedColor.lightened }
            : { backgroundColor: ThemedColor.background, borderColor: ThemedColor.tertiary };

    return (
        <Animated.View entering={FadeIn.duration(200)} style={styles.open}>
            <ThemedInput
                value={code}
                setValue={(text) => {
                    setCode(formatConnectionCode(text));
                    if (error) setError(null);
                }}
                placeHolder="XXXX-XXXX"
                autofocus
                onSubmit={submit}
                textStyle={[styles.codeText, inputSurface]}
                inputProps={{
                    autoCapitalize: "characters",
                    autoCorrect: false,
                    autoComplete: "off",
                    spellCheck: false,
                    maxLength: 9,
                    returnKeyType: "go",
                    placeholderTextColor: ThemedColor.caption,
                    accessibilityLabel: "Connection code",
                }}
            />
            {error ? (
                <Animated.View entering={FadeIn.duration(200)}>
                    <ThemedText type="caption" style={{ color: ThemedColor.error }}>
                        {error}
                    </ThemedText>
                </Animated.View>
            ) : (
                <ThemedText type="caption">The code is shown on the page your assistant opened.</ThemedText>
            )}
            <PrimaryButton
                title={looking ? "Checking" : "Continue"}
                onPress={submit}
                disabled={!canonical || looking}
            />
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
    },
    lead: {
        width: 52,
    },
    open: {
        gap: 12,
    },
    codeText: {
        fontSize: 20,
        letterSpacing: 2,
    },
});

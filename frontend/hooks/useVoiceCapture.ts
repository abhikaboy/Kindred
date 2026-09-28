import { useEffect, useRef, useState } from "react";
import { Keyboard } from "react-native";
import { useSharedValue } from "react-native-reanimated";
import {
    ENABLE_SPEECH_RECOGNITION,
    ExpoSpeechRecognitionModule,
    useSpeechRecognitionEvent,
} from "@/utils/speechRecognition";
import { logger } from "@/utils/logger";

const SILENCE_GRACE_MS = 4000;
// If the recognizer never reports "start", fail loudly instead of leaving the mic stuck
const START_TIMEOUT_MS = 4000;

type Options = {
    text: string;
    setText: (text: string) => void;
    /** A tap to start is ignored while set (e.g. mid-submit). */
    disabled?: boolean;
    /** True once the host has started closing; late results and errors are dropped. */
    isClosing: () => boolean;
    /** Hand the line back to the keyboard after a failure. */
    refocus: () => void;
};

/**
 * Dictation into a composer's text field: the transcript continues whatever
 * was already typed, and recognition stops after a stretch of silence.
 *
 * `voiceModeRef` is set while voice owns the screen, so a host that closes on
 * keyboard hide can tell the mic dropping the keyboard apart from "done".
 */
export function useVoiceCapture({ text, setText, disabled = false, isClosing, refocus }: Options) {
    const [listening, setListening] = useState(false);
    const voiceModeRef = useRef(false);
    const listeningRef = useRef(false);
    // Between start() and the "start" event; a tap here must stop, not start twice
    const startingRef = useRef(false);
    // Permission prompt is up
    const requestingRef = useRef(false);
    const transcriptBaseRef = useRef("");
    const finalizedRef = useRef("");
    const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const startTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const volume = useSharedValue(0);

    useEffect(
        () => () => {
            if (silenceTimer.current) clearTimeout(silenceTimer.current);
            if (startTimer.current) clearTimeout(startTimer.current);
            if (listeningRef.current || startingRef.current) ExpoSpeechRecognitionModule?.stop();
        },
        []
    );

    const armSilenceTimer = () => {
        if (silenceTimer.current) clearTimeout(silenceTimer.current);
        silenceTimer.current = setTimeout(() => {
            if (listeningRef.current) ExpoSpeechRecognitionModule?.stop();
        }, SILENCE_GRACE_MS);
    };

    function stopListening() {
        if (silenceTimer.current) clearTimeout(silenceTimer.current);
        if (listeningRef.current || startingRef.current) ExpoSpeechRecognitionModule?.stop();
    }

    function endListening() {
        listeningRef.current = false;
        setListening(false);
        volume.value = 0;
        if (silenceTimer.current) clearTimeout(silenceTimer.current);
    }

    // Stop and drop anything still in flight, so a late final result can't
    // refill the field after the line was used or the composer closed.
    function cancelListening() {
        stopListening();
        startingRef.current = false;
        if (listeningRef.current) endListening();
    }

    const voiceError = async (title: string, message: string) => {
        voiceModeRef.current = false;
        const { showToastable } = await import("react-native-toastable");
        showToastable({ title, message, status: "warning", duration: 3000 });
        // Hand the line back to the keyboard so there's still a way forward
        if (!isClosing()) refocus();
    };

    // Recognition is a global singleton; only react to sessions this composer started.
    useSpeechRecognitionEvent("start", () => {
        if (!startingRef.current) return;
        if (startTimer.current) clearTimeout(startTimer.current);
        startingRef.current = false;
        listeningRef.current = true;
        setListening(true);
        finalizedRef.current = "";
        armSilenceTimer();
    });
    useSpeechRecognitionEvent("end", () => {
        startingRef.current = false;
        if (listeningRef.current) endListening();
    });
    useSpeechRecognitionEvent("error", (event) => {
        const ours = listeningRef.current || startingRef.current;
        startingRef.current = false;
        if (listeningRef.current) endListening();
        if (!ours) return;
        // Silence, timeouts and our own stop() aren't failures; keep whatever was heard.
        const code = event?.error;
        if (code === "no-speech" || code === "speech-timeout" || code === "aborted" || code === "client") return;
        if (code === "not-allowed" || code === "service-not-allowed") {
            voiceError("Microphone is off", "Enable microphone and speech access in Settings to add tasks by voice.");
        } else if (code === "network") {
            voiceError("Voice needs a connection", "Check your connection, or type the task instead.");
        } else if (code === "audio-capture" || code === "busy") {
            voiceError("Microphone is busy", "Another app may be using it. Try again in a moment.");
        } else {
            voiceError("Voice input failed", "Try again, or type the task instead.");
        }
    });
    useSpeechRecognitionEvent("result", (event) => {
        if (!listeningRef.current) return;
        const seg = (event.results[0]?.transcript ?? "").trim();
        if (seg) {
            const base = finalizedRef.current;
            const merged = !base ? seg : seg.startsWith(base) ? seg : `${base} ${seg}`;
            if (event.isFinal) finalizedRef.current = merged;
            // Speech continues whatever was already typed
            const prefix = transcriptBaseRef.current;
            setText(prefix ? `${prefix} ${merged}` : merged);
        }
        armSilenceTimer();
    });
    useSpeechRecognitionEvent("volumechange", (event) => {
        if (!listeningRef.current) return;
        const value = typeof event?.value === "number" ? event.value : 0;
        const norm = Math.max(0, Math.min(1, (value - 1.5) / 7.5));
        volume.value = Math.pow(norm, 1.4);
        if (norm > 0.12) armSilenceTimer();
    });

    const toggleMic = async () => {
        if (listeningRef.current || startingRef.current) {
            // Tapping again while starting or listening means stop
            stopListening();
            return;
        }
        if (requestingRef.current || disabled) return;
        let available = !!ExpoSpeechRecognitionModule;
        try {
            available = available && (ExpoSpeechRecognitionModule?.isRecognitionAvailable?.() ?? true);
        } catch (error) {
            logger.error("Speech availability check failed", error);
            available = false;
        }
        if (!ENABLE_SPEECH_RECOGNITION || !ExpoSpeechRecognitionModule || !available) {
            logger.warn("Speech recognition unavailable; native module missing or service disabled");
            voiceError("Voice isn't available", "Type the task instead.");
            return;
        }
        voiceModeRef.current = true;
        Keyboard.dismiss();
        requestingRef.current = true;
        let granted = false;
        try {
            granted = !!(await ExpoSpeechRecognitionModule.requestPermissionsAsync()).granted;
        } catch (error) {
            logger.error("Speech permission request failed", error);
        } finally {
            requestingRef.current = false;
        }
        // The composer may have closed while the permission prompt was up
        if (isClosing()) return;
        if (!granted) {
            voiceError("Microphone is off", "Enable microphone and speech access in Settings to add tasks by voice.");
            return;
        }
        transcriptBaseRef.current = text.trim();
        startingRef.current = true;
        if (startTimer.current) clearTimeout(startTimer.current);
        startTimer.current = setTimeout(() => {
            if (!startingRef.current) return;
            startingRef.current = false;
            ExpoSpeechRecognitionModule?.stop();
            logger.warn("Speech recognition never started");
            voiceError("Voice input failed", "Try again, or type the task instead.");
        }, START_TIMEOUT_MS);
        try {
            ExpoSpeechRecognitionModule.start({
                lang: "en-US",
                interimResults: true,
                continuous: true,
                maxAlternatives: 1,
                recordingOptions: { persist: false },
                volumeChangeEventOptions: { enabled: true, intervalMillis: 100 },
                androidIntentOptions: {
                    EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: SILENCE_GRACE_MS,
                    EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: SILENCE_GRACE_MS,
                },
            });
        } catch (error) {
            startingRef.current = false;
            if (startTimer.current) clearTimeout(startTimer.current);
            logger.error("Speech recognition failed to start", error);
            voiceError("Voice input failed", "Try again, or type the task instead.");
        }
    };

    return { listening, volume, toggleMic, cancelListening, voiceModeRef };
}

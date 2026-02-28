export const ENABLE_SPEECH_RECOGNITION = true;

type SpeechRecognitionModule = {
    requestPermissionsAsync: () => Promise<{ granted?: boolean }>;
    start: (options: Record<string, unknown>) => void;
    stop: () => void;
} ;

let ExpoSpeechRecognitionModule: SpeechRecognitionModule | null = null;
let useSpeechRecognitionEvent: (event: string, handler: (...args: any[]) => void) => void = () => {};

if (ENABLE_SPEECH_RECOGNITION) {
    try {
        const mod = require("expo-speech-recognition");
        ExpoSpeechRecognitionModule = mod.ExpoSpeechRecognitionModule ?? null;
        useSpeechRecognitionEvent = mod.useSpeechRecognitionEvent ?? (() => {});
    } catch (error) {
        console.warn("Speech recognition disabled (module unavailable).", error);
        ExpoSpeechRecognitionModule = null;
        useSpeechRecognitionEvent = () => {};
    }
}

export { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent };

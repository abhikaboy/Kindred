import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    Animated,
    Dimensions,
    Easing,
    Pressable,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
    ENABLE_SPEECH_RECOGNITION,
    ExpoSpeechRecognitionModule,
    useSpeechRecognitionEvent,
} from "@/utils/speechRecognition";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useTasks } from "@/contexts/tasksContext";
import { useIntentRouterFlow } from "@/hooks/useIntentRouterFlow";
import type { components } from "@/api/generated/types";
import type { Task } from "@/api/types";
import TaskCard from "@/components/cards/TaskCard";

const { height: SCREEN_HEIGHT } = Dimensions.get("screen");
const TAB_BAR_HEIGHT = 83;
const GRADIENT_HEIGHT = SCREEN_HEIGHT * 0.65;
const DEV_FALLBACK_TRANSCRIPTION = "shovel the snow at noon tomorrow";

const PLACEHOLDER_SUGGESTIONS = [
    'Try saying "Add a gym session tomorrow at 7am"',
    'Try saying "Delete all my low priority tasks"',
    'Try saying "Move my dentist appointment to Friday"',
    'Try saying "Add buy groceries and call mom"',
    'Try saying "Reschedule my 3pm meeting to next Tuesday"',
    'Try saying "Create a task to review the report by Friday"',
    'Try saying "Mark my work tasks as high priority"',
    'Try saying "Add a weekly team standup every Monday at 9am"',
    'Try saying "Delete my boba run with Bob"',
    'Try saying "Add water plants, do laundry, and clean kitchen"',
];

interface VoiceInputOverlayProps {
    onClose: () => void;
}

const StaggeredTaskCard: React.FC<{ index: number; children: React.ReactNode }> = ({ index, children }) => {
    const translateY = useRef(new Animated.Value(20)).current;
    const translateX = useRef(new Animated.Value(-8)).current;
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const delay = Math.min(index * 120, 600);
        Animated.sequence([
            Animated.delay(delay),
            Animated.parallel([
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 280,
                    useNativeDriver: true,
                }),
                Animated.spring(translateY, {
                    toValue: 0,
                    tension: 100,
                    friction: 13,
                    useNativeDriver: true,
                }),
                Animated.spring(translateX, {
                    toValue: 0,
                    tension: 110,
                    friction: 14,
                    useNativeDriver: true,
                }),
            ]),
        ]).start();
    }, []);

    return (
        <Animated.View style={{ opacity, transform: [{ translateX }, { translateY }] }}>
            {children}
        </Animated.View>
    );
};

export const VoiceInputOverlay: React.FC<VoiceInputOverlayProps> = ({ onClose }) => {
    const ThemedColor = useThemeColor();
    const insets = useSafeAreaInsets();
    const { fetchWorkspaces, workspaces } = useTasks();

    const [recognizing, setRecognizing] = useState(false);
    const [transcription, setTranscription] = useState("");
    const [pendingClose, setPendingClose] = useState(false);

    const {
        isPreviewing,
        isConfirming,
        isDeletingTasks,
        previewPayload,
        editResult,
        deletePreviewTasks,
        errorTitle,
        errorDetails,
        pendingOpsCount,
        currentOpIndex,
        processText,
        confirmCreate,
        dismissEditResult,
        confirmDelete,
        dismissDelete,
        reset: resetIntentFlow,
        setError,
        clearError,
    } = useIntentRouterFlow({
        onComplete: () => {
            fetchWorkspaces(true);
            setPendingClose(true);
        },
    });

    const hasPreview = previewPayload !== null;
    const hasEditResult = editResult !== null;
    const hasDeletePreview = deletePreviewTasks.length > 0;

    // Local selection state for the inline delete view — all tasks pre-selected.
    const [deleteSelected, setDeleteSelected] = useState<Set<string>>(new Set());
    useEffect(() => {
        setDeleteSelected(new Set(deletePreviewTasks.map((t) => t.id)));
    }, [deletePreviewTasks]);
    const transcriptionWords = useMemo(
        () => transcription.trim().split(/\s+/).filter(Boolean),
        [transcription]
    );

    // Prevents double-firing exit animation (e.g. rapid X presses)
    const isClosingRef = useRef(false);
    // Kept in a ref so the cleanup effect can check it without a stale closure
    const recognizingRef = useRef(false);

    // Animated values
    const backdropOpacity = useRef(new Animated.Value(0)).current;
    const gradientOpacity = useRef(new Animated.Value(0)).current;
    const previewOpacity = useRef(new Animated.Value(0)).current;
    const previewTranslateY = useRef(new Animated.Value(-18)).current;
    const detailOpacity = useRef(new Animated.Value(0)).current;
    const detailTranslateY = useRef(new Animated.Value(12)).current;
    const micOpacity = useRef(new Animated.Value(0)).current;
    const micTranslateY = useRef(new Animated.Value(25)).current;
    const closeBtnOpacity = useRef(new Animated.Value(0)).current;
    const generateBtnOpacity = useRef(new Animated.Value(0)).current;
    const stopPillOpacity = useRef(new Animated.Value(0)).current;
    const stopPillTranslateY = useRef(new Animated.Value(8)).current;
    const micScale = useRef(new Animated.Value(1)).current;
    const readingProgress = useRef(new Animated.Value(0)).current;

    // Fades the entire mic section out independently of the enter/exit animation.
    const micSectionOpacity = useRef(new Animated.Value(1)).current;

    // Rotating placeholder suggestions
    const [suggestionIndex, setSuggestionIndex] = useState(0);
    const suggestionOpacity = useRef(new Animated.Value(1)).current;

    const micPulse = useRef<Animated.CompositeAnimation | null>(null);
    const readingLoop = useRef<Animated.CompositeAnimation | null>(null);

    // ─── Pulse ────────────────────────────────────────────────────────────────

    const startPulse = () => {
        micPulse.current = Animated.loop(
            Animated.sequence([
                Animated.timing(micScale, {
                    toValue: 1.12,
                    duration: 600,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(micScale, {
                    toValue: 1,
                    duration: 600,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
            ])
        );
        micPulse.current.start();
    };

    const stopPulse = () => {
        micPulse.current?.stop();
        micPulse.current = null;
        Animated.timing(micScale, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    };

    // ─── Enter / exit animations ───────────────────────────────────────────────

    const animateIn = () => {
        // stopTogether: false prevents the show/hide previewOpacity effect (which also
        // runs on mount) from cancelling the entire parallel when it starts its own
        // animation on previewOpacity.
        Animated.parallel([
            Animated.timing(backdropOpacity, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.timing(gradientOpacity, {
                toValue: 1,
                duration: 350,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true,
            }),
            Animated.timing(closeBtnOpacity, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.parallel([
                Animated.timing(previewOpacity, {
                    toValue: 1,
                    duration: 320,
                    delay: 150,
                    useNativeDriver: true,
                }),
                Animated.timing(previewTranslateY, {
                    toValue: 0,
                    duration: 320,
                    delay: 150,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
            ]),
            Animated.parallel([
                Animated.timing(micOpacity, {
                    toValue: 1,
                    duration: 300,
                    delay: 100,
                    useNativeDriver: true,
                }),
                Animated.timing(micTranslateY, {
                    toValue: 0,
                    duration: 300,
                    delay: 100,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
            ]),
        ], { stopTogether: false }).start();
    };

    const animateOut = (callback: () => void) => {
        stopPulse();
        Animated.parallel([
            Animated.timing(backdropOpacity, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
            }),
            Animated.timing(gradientOpacity, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
            }),
            Animated.timing(closeBtnOpacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(previewOpacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(previewTranslateY, {
                toValue: -12,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(detailOpacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(detailTranslateY, {
                toValue: 12,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(micOpacity, {
                toValue: 0,
                duration: 220,
                useNativeDriver: true,
            }),
            Animated.timing(micTranslateY, {
                toValue: 20,
                duration: 220,
                useNativeDriver: true,
            }),
            Animated.timing(generateBtnOpacity, {
                toValue: 0,
                duration: 180,
                useNativeDriver: true,
            }),
            Animated.timing(stopPillOpacity, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
            }),
        ]).start(() => callback());
    };

    // Animate in on mount. Stop recognition if the parent force-unmounts us.
    useEffect(() => {
        animateIn();
        return () => {
            if (recognizingRef.current && ExpoSpeechRecognitionModule) {
                ExpoSpeechRecognitionModule.stop();
            }
        };
    }, []);

    // ─── Generate button visibility ────────────────────────────────────────────

    useEffect(() => {
        // Delete preview uses detailOpacity directly — don't show generateBtnOpacity for it.
        if (hasPreview) {
            Animated.timing(generateBtnOpacity, {
                toValue: 1,
                duration: 250,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true,
            }).start();
            return;
        }
        if (hasDeletePreview) {
            Animated.timing(generateBtnOpacity, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
            }).start();
            return;
        }
        if ((transcription && !recognizing) || hasEditResult) {
            Animated.timing(generateBtnOpacity, {
                toValue: 1,
                duration: 250,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true,
            }).start();
        } else {
            Animated.timing(generateBtnOpacity, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
            }).start();
        }
    }, [transcription, recognizing, hasPreview, hasEditResult, hasDeletePreview]);

    useEffect(() => {
        // Hide previewSection when a full-screen detail view is active (create or delete).
        // Edit results render inline inside previewSection so they don't trigger this.
        const showDetail = hasPreview || hasDeletePreview;
        Animated.parallel([
            Animated.timing(previewOpacity, {
                toValue: showDetail ? 0 : 1,
                duration: 220,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true,
            }),
            Animated.timing(detailOpacity, {
                toValue: showDetail ? 1 : 0,
                duration: 240,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true,
            }),
            Animated.timing(detailTranslateY, {
                toValue: showDetail ? 0 : 12,
                duration: 240,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true,
            }),
        ]).start();
    }, [hasEditResult, hasPreview, hasDeletePreview, detailOpacity, detailTranslateY, previewOpacity]);

    useEffect(() => {
        if (!isPreviewing || transcriptionWords.length === 0) {
            readingLoop.current?.stop();
            readingLoop.current = null;
            readingProgress.setValue(0);
            return;
        }

        readingLoop.current?.stop();
        readingProgress.setValue(0);
        const duration = Math.max(1600, transcriptionWords.length * 520);
        readingLoop.current = Animated.loop(
            Animated.timing(readingProgress, {
                toValue: Math.max(1, transcriptionWords.length - 1),
                duration,
                easing: Easing.linear,
                useNativeDriver: false,
            })
        );
        readingLoop.current.start();

        return () => {
            readingLoop.current?.stop();
            readingLoop.current = null;
        };
    }, [isPreviewing, transcriptionWords.length]);

    // ─── Stop-pill visibility ──────────────────────────────────────────────────

    useEffect(() => {
        if (recognizing) {
            Animated.parallel([
                Animated.timing(stopPillOpacity, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.timing(stopPillTranslateY, {
                    toValue: 0,
                    duration: 200,
                    easing: Easing.out(Easing.ease),
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(stopPillOpacity, {
                    toValue: 0,
                    duration: 150,
                    useNativeDriver: true,
                }),
                Animated.timing(stopPillTranslateY, {
                    toValue: 8,
                    duration: 150,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [recognizing]);

    // ─── Rotate placeholder suggestions every 4s ──────────────────────────────

    useEffect(() => {
        // Only rotate when the placeholder is actually visible
        if (transcription || recognizing) return;

        const interval = setInterval(() => {
            Animated.timing(suggestionOpacity, {
                toValue: 0,
                duration: 350,
                useNativeDriver: true,
            }).start(() => {
                setSuggestionIndex((i) => (i + 1) % PLACEHOLDER_SUGGESTIONS.length);
                Animated.timing(suggestionOpacity, {
                toValue: 1,
                    duration: 350,
                    useNativeDriver: true,
                }).start();
            });
        }, 6000);

        return () => clearInterval(interval);
    }, [transcription, recognizing, suggestionOpacity]);

    // ─── Hide mic button when delete preview is active ────────────────────────

    useEffect(() => {
        Animated.timing(micSectionOpacity, {
            toValue: hasDeletePreview ? 0 : 1,
            duration: 200,
            useNativeDriver: true,
        }).start();
    }, [hasDeletePreview]);

    // ─── Speech recognition events ────────────────────────────────────────────

    useSpeechRecognitionEvent("start", () => {
        clearError();
        recognizingRef.current = true;
        setRecognizing(true);
        startPulse();
    });

    useSpeechRecognitionEvent("end", () => {
        recognizingRef.current = false;
        setRecognizing(false);
        stopPulse();
    });

    useSpeechRecognitionEvent("result", (event) => {
        const t = event.results[0]?.transcript;
        if (t) setTranscription(t);
    });

    useSpeechRecognitionEvent("error", () => {
        recognizingRef.current = false;
        setRecognizing(false);
        stopPulse();
        setError("Voice Input Failed", ["Try again or type a request."]);
    });

    // ─── Handlers ─────────────────────────────────────────────────────────────

    const handleMicPress = async () => {
        if (!ENABLE_SPEECH_RECOGNITION || !ExpoSpeechRecognitionModule) {
            setError("Speech Recognition Disabled", ["Please enable speech recognition in the app settings."]);
            return;
        }
        if (recognizing) {
            ExpoSpeechRecognitionModule.stop();
            return;
        }
        const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        if (!result.granted) {
            setError("Microphone Permission Denied", ["Enable microphone access in Settings."]);
            return;
        }
        clearError();
        ExpoSpeechRecognitionModule.start({
            lang: "en-US",
            interimResults: true,
            continuous: false,
            maxAlternatives: 1,
            recordingOptions: { persist: false },
        });
    };

    const handleStopRecording = () => {
        if (!ExpoSpeechRecognitionModule) return;
        ExpoSpeechRecognitionModule.stop();
    };

    const handleClose = React.useCallback(() => {
        if (isClosingRef.current) return;
        isClosingRef.current = true;
        if (recognizingRef.current && ExpoSpeechRecognitionModule) {
            ExpoSpeechRecognitionModule.stop();
        }
        // Animate out fully, THEN tell the parent to unmount us.
        // The parent's conditional render ({voiceOverlayVisible && <VoiceInputOverlay/>})
        // means the unmount happens after everything is already at opacity 0 — no snap.
        animateOut(() => {
            setTranscription("");
            resetIntentFlow();
            setPendingClose(false);
            onClose();
        });
    }, [onClose, resetIntentFlow]);

    const handleRetry = () => {
        setTranscription("");
        resetIntentFlow();
    };

    const handleProcessRequest = () => {
        if (transcription.trim().length < 4 || isPreviewing || isConfirming) return;
        processText(transcription.trim());
    };

    useEffect(() => {
        if (!pendingClose) return;
        setPendingClose(false);
        handleClose();
    }, [handleClose, pendingClose]);

    // ─── Render ───────────────────────────────────────────────────────────────

    const groupedCategories = useMemo(() => {
        if (!previewPayload) return [];
        const categoryMap = new Map<string, { name: string; workspace: string }>();
        workspaces.forEach((workspace) => {
            workspace.categories.forEach((category) => {
                categoryMap.set(category.id, {
                    name: category.name,
                    workspace: workspace.name,
                });
            });
        });

        const groups: Array<{
            categoryId: string;
            categoryName: string;
            workspace?: string;
            isNew: boolean;
            tasks: Task[];
        }> = [];

        const buildTask = (taskParams: any, id: string, categoryId: string): Task => ({
            id,
            content: taskParams.content || "",
            value: taskParams.value ?? 5,
            priority: taskParams.priority ?? 2,
            recurring: taskParams.recurring ?? false,
            recurFrequency: taskParams.recurFrequency,
            recurType: taskParams.recurType,
            recurDetails: taskParams.recurDetails,
            public: taskParams.public ?? false,
            active: true,
            timestamp: new Date().toISOString(),
            lastEdited: new Date().toISOString(),
            templateID: taskParams.templateID,
            userID: taskParams.userID,
            categoryID: categoryId,
            deadline: taskParams.deadline,
            startTime: taskParams.startTime,
            startDate: taskParams.startDate,
            notes: taskParams.notes,
            checklist: taskParams.checklist,
            reminders: taskParams.reminders,
        });

        previewPayload.categories.forEach((category, index) => {
            const categoryId = `preview-new-${index}`;
            groups.push({
                categoryId,
                categoryName: category.name || "New Category",
                workspace: category.workspaceName || "General",
                isNew: true,
                tasks: category.tasks.map((task, taskIndex) =>
                    buildTask(task, `${categoryId}-${taskIndex}`, categoryId)
                ),
            });
        });

        const existingGroups = new Map<string, typeof groups[number]>();
        previewPayload.tasks.forEach((pair, index) => {
            const categoryId = pair.categoryId || `preview-existing-${index}`;
            if (!existingGroups.has(categoryId)) {
                const info = categoryMap.get(categoryId);
                existingGroups.set(categoryId, {
                    categoryId,
                    categoryName: info?.name || pair.categoryName || "Unknown Category",
                    workspace: info?.workspace,
                    isNew: false,
                    tasks: [],
                });
            }
            existingGroups.get(categoryId)!.tasks.push(
                buildTask(pair.task, `${categoryId}-${index}`, categoryId)
            );
        });

        return [...groups, ...Array.from(existingGroups.values())];
    }, [previewPayload, workspaces]);

    return (
        <View style={styles.overlayRoot} pointerEvents="box-none">
            {/* Background layer */}
            <View style={styles.backgroundLayer} pointerEvents="none">
                {/* Blurred full-screen backdrop */}
                <Animated.View
                    style={[StyleSheet.absoluteFill, styles.blurWrapper, { opacity: backdropOpacity }]}
                >
                    <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFill} />
                    <View style={[StyleSheet.absoluteFill, styles.dimOverlay]} />
                </Animated.View>

                {/* Dark gradient from top */}
                <Animated.View
                    style={[styles.gradientWrapper, { opacity: gradientOpacity }]}
                >
                    <LinearGradient
                        colors={[
                            "rgba(0,0,0,0.92)",
                            "rgba(0,0,0,0.78)",
                            "rgba(0,0,0,0.28)",
                            "transparent",
                        ]}
                        locations={[0, 0.38, 0.72, 1]}
                        style={StyleSheet.absoluteFill}
                    />
                </Animated.View>
            </View>

            {/* Intercept background touches and dismiss */}
            <Pressable
                onPress={handleClose}
                style={styles.touchInterceptor}
                pointerEvents="auto"
            />

            {/* Content layer */}
            <View style={styles.contentLayer} pointerEvents="box-none">
                {/* Close button */}
                <Animated.View
                    style={[styles.closeButton, { top: insets.top + 12, opacity: closeBtnOpacity }]}
                >
                    <TouchableOpacity
                        onPress={handleClose}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    >
                        <View style={styles.closeButtonInner}>
                            <Ionicons name="close" size={20} color="#ffffff" />
                        </View>
                    </TouchableOpacity>
                </Animated.View>

                {/* Preview section */}
                <Animated.View
                    style={[
                        styles.previewSection,
                        {
                            top: insets.top + 64,
                            opacity: previewOpacity,
                            transform: [{ translateY: previewTranslateY }],
                        },
                    ]}
                    pointerEvents="none"
                >
                    <View style={styles.previewLabelRow}>
                        <ThemedText style={styles.previewLabel}>
                            {hasEditResult ? "Updated" : "Preview"}
                        </ThemedText>
                        {pendingOpsCount > 1 && (
                            <ThemedText style={styles.stepCounter}>
                                {currentOpIndex + 1} / {pendingOpsCount}
                            </ThemedText>
                        )}
                    </View>
                    {!!errorTitle && (
                        <View style={styles.errorBanner}>
                            <ThemedText style={styles.errorBannerTitle}>{errorTitle}</ThemedText>
                            {errorDetails.map((detail, index) => (
                                <ThemedText key={`${detail}-${index}`} style={styles.errorBannerText}>
                                    {detail}
                                </ThemedText>
                            ))}
                        </View>
                    )}
                    {hasEditResult && !hasPreview ? (
                        <>
                            <ThemedText style={styles.transcriptionText}>
                                {editResult!.editedCount === 0
                                    ? "No tasks updated"
                                    : editResult!.editedCount === 1
                                        ? "1 task updated"
                                        : `${editResult!.editedCount} tasks updated`}
                            </ThemedText>
                            {editResult!.tasks.map((t, i) => (
                                <ThemedText key={(t as any).id ?? i} style={styles.editResultTaskName}>
                                    {t.content}
                                </ThemedText>
                            ))}
                            {editResult!.templates.map((t, i) => (
                                <ThemedText key={(t as any).id ?? i} style={styles.editResultTaskName}>
                                    {t.content}{" "}
                                    <ThemedText style={styles.editResultRecurringTag}>(recurring)</ThemedText>
                                </ThemedText>
                            ))}
                        </>
                    ) : !hasPreview ? (
                        <>
                            {transcription ? (
                                <ThemedText style={styles.transcriptionText}>
                                    {isPreviewing ? (
                                        transcriptionWords.map((word, index) => (
                                            <Animated.Text
                                                key={`${word}-${index}`}
                                                style={[
                                                    styles.transcriptionWord,
                                                    {
                                                        opacity: readingProgress.interpolate({
                                                            inputRange: [index - 1, index, index + 1],
                                                            outputRange: [0.25, 1, 0.25],
                                                            extrapolate: "clamp",
                                                        }),
                                                    },
                                                ]}
                                            >
                                                {word}
                                                {index < transcriptionWords.length - 1 ? " " : ""}
                                            </Animated.Text>
                                        ))
                                    ) : (
                                        transcription
                                    )}
                                </ThemedText>
                            ) : (
                                recognizing ? (
                                    <ThemedText style={styles.placeholderText}>
                                        Listening for your voice...
                                    </ThemedText>
                                ) : (
                                    <Animated.Text
                                        style={[styles.placeholderText, { opacity: suggestionOpacity }]}
                                    >
                                        {PLACEHOLDER_SUGGESTIONS[suggestionIndex]}
                                    </Animated.Text>
                                )
                            )}
                        </>
                    ) : null}
                </Animated.View>
            {(hasPreview || hasDeletePreview) && (
                <Animated.View
                    style={[
                        styles.previewListWrapper,
                        {
                            top: insets.top + 60,
                            opacity: detailOpacity,
                            transform: [{ translateY: detailTranslateY }],
                        },
                    ]}
                    pointerEvents="auto"
                >
                    {hasPreview && (
                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.previewListContent}
                        >
                            {pendingOpsCount > 1 && (
                                <View style={styles.previewLabelRow}>
                                    <ThemedText style={styles.previewLabel}>Preview</ThemedText>
                                    <ThemedText style={styles.stepCounter}>
                                        {currentOpIndex + 1} / {pendingOpsCount}
                                    </ThemedText>
                                </View>
                            )}
                            {(() => {
                                let taskIndex = 0;
                                return groupedCategories.map((category) => (
                                    <View key={category.categoryId} style={styles.previewCategory}>
                                        {category.workspace && (
                                            <ThemedText style={styles.previewWorkspaceLabel}>
                                                Workspace: {category.workspace}
                                            </ThemedText>
                                        )}
                                        <View style={styles.previewCategoryHeader}>
                                            <ThemedText style={styles.previewCategoryTitle}>
                                                {category.categoryName}
                                            </ThemedText>
                                            {category.isNew && (
                                                <View
                                                    style={[
                                                        styles.previewNewBadge,
                                                        { backgroundColor: `${ThemedColor.primary}1F` },
                                                    ]}
                                                >
                                                    <ThemedText
                                                        style={[
                                                            styles.previewNewBadgeText,
                                                            { color: ThemedColor.primary },
                                                        ]}
                                                    >
                                                        NEW
                                                    </ThemedText>
                                                </View>
                                            )}
                                        </View>
                                        <View style={styles.previewTasks}>
                                            {category.tasks.map((task) => {
                                                const idx = taskIndex++;
                                                return (
                                                    <StaggeredTaskCard key={task.id} index={idx}>
                                                        <TaskCard
                                                            content={task.content}
                                                            value={task.value}
                                                            priority={task.priority as any}
                                                            id={task.id}
                                                            categoryId={category.categoryId}
                                                            redirect={false}
                                                            task={task}
                                                        />
                                                    </StaggeredTaskCard>
                                                );
                                            })}
                                        </View>
                                    </View>
                                ));
                            })()}
                        </ScrollView>
                    )}

                {/* Delete preview — inline task rows with checkboxes */}
                {hasDeletePreview && (
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.deleteListContent}
                    >
                        {pendingOpsCount > 1 && (
                            <View style={styles.previewLabelRow}>
                                <ThemedText style={styles.previewLabel}>Delete</ThemedText>
                                <ThemedText style={styles.stepCounter}>
                                    {currentOpIndex + 1} / {pendingOpsCount}
                                </ThemedText>
                            </View>
                        )}
                        <ThemedText style={styles.deleteSubtitle}>
                            Deselect tasks you want to keep.
                        </ThemedText>
                        {deletePreviewTasks.map((task) => {
                            const isChecked = deleteSelected.has(task.id);
                            return (
                                <TouchableOpacity
                                    key={task.id}
                                    style={[
                                        styles.deleteTaskRow,
                                        isChecked && styles.deleteTaskRowSelected,
                                    ]}
                                    onPress={() =>
                                        setDeleteSelected((prev) => {
                                            const next = new Set(prev);
                                            if (next.has(task.id)) next.delete(task.id);
                                            else next.add(task.id);
                                            return next;
                                        })
                                    }
                                    activeOpacity={0.7}
                                >
                                    <View
                                        style={[
                                            styles.deleteCheckbox,
                                            isChecked && styles.deleteCheckboxChecked,
                                        ]}
                                    >
                                        {isChecked && (
                                            <Ionicons name="checkmark" size={11} color="#fff" />
                                        )}
                                    </View>
                                    <View style={styles.deleteTaskInfo}>
                                        <ThemedText style={styles.deleteTaskContent} numberOfLines={2}>
                                            {task.content}
                                        </ThemedText>
                                        {(task.priority !== undefined || task.deadline) && (
                                            <View style={styles.deleteTaskMeta}>
                                                {task.priority !== undefined && (
                                                    <ThemedText style={styles.deleteMetaText}>
                                                        {["Low", "Medium", "High"][task.priority - 1] ?? "—"} priority
                                                    </ThemedText>
                                                )}
                                                {task.deadline && (
                                                    <ThemedText style={styles.deleteMetaText}>
                                                        Due {new Date(task.deadline).toLocaleDateString()}
                                                    </ThemedText>
                                                )}
                                            </View>
                                        )}
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                )}
                </Animated.View>
            )}

            {/* Delete action buttons */}
            {hasDeletePreview && (
                <Animated.View
                    style={[
                        styles.deleteActionsWrapper,
                        {
                            bottom: insets.bottom + TAB_BAR_HEIGHT + 20,
                            opacity: detailOpacity,
                            transform: [{ translateY: detailTranslateY }],
                        },
                    ]}
                    pointerEvents="auto"
                >
                    <TouchableOpacity
                        onPress={dismissDelete}
                        style={styles.deleteSkipBtn}
                        activeOpacity={0.75}
                        disabled={isDeletingTasks}
                    >
                        <ThemedText style={styles.deleteSkipBtnText}>Skip</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => confirmDelete([...deleteSelected])}
                        style={[
                            styles.deleteConfirmBtn,
                            deleteSelected.size === 0 && styles.deleteConfirmBtnDisabled,
                        ]}
                        activeOpacity={0.85}
                        disabled={isDeletingTasks || deleteSelected.size === 0}
                    >
                        {isDeletingTasks ? (
                            <Ionicons name="hourglass-outline" size={18} color="#fff" />
                        ) : (
                            <ThemedText style={styles.deleteConfirmBtnText}>
                                Delete {deleteSelected.size > 0 ? `${deleteSelected.size} ` : ""}
                                {deleteSelected.size === 1 ? "Task" : "Tasks"}
                            </ThemedText>
                        )}
                    </TouchableOpacity>
                </Animated.View>
            )}

            {hasPreview && (
                <Animated.View
                    style={[
                        styles.generateButtonWrapper,
                        {
                            bottom: insets.bottom + TAB_BAR_HEIGHT + 128,
                            opacity: generateBtnOpacity,
                            transform: [
                                {
                                    translateY: generateBtnOpacity.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [10, 0],
                                    }),
                                },
                            ],
                        },
                    ]}
                    pointerEvents="auto"
                >
                    <TouchableOpacity
                        onPress={confirmCreate}
                        style={[styles.generateButton, { backgroundColor: ThemedColor.primary }]}
                        activeOpacity={0.85}
                        disabled={isConfirming}
                    >
                        <ThemedText style={styles.generateButtonText}>
                            {isConfirming
                                ? "Creating..."
                                : currentOpIndex + 1 < pendingOpsCount
                                    ? "Confirm & Next"
                                    : "Confirm Create"}
                        </ThemedText>
                    </TouchableOpacity>
                </Animated.View>
            )}


            {/* Stop recording pill — slides up when listening */}
            <Animated.View
                style={[
                    styles.stopPillWrapper,
                    {
                        bottom: insets.bottom + TAB_BAR_HEIGHT + 120,
                        opacity: stopPillOpacity,
                        transform: [{ translateY: stopPillTranslateY }],
                    },
                ]}
                pointerEvents={!hasPreview && recognizing ? "auto" : "none"}
            >
                <TouchableOpacity
                    onPress={handleStopRecording}
                    style={styles.stopPill}
                    activeOpacity={0.8}
                >
                    <Ionicons
                        name="stop-circle"
                        size={16}
                        color="#ffffff"
                        style={{ marginRight: 6 }}
                    />
                    <ThemedText style={styles.stopPillText}>Stop Recording</ThemedText>
                </TouchableOpacity>
            </Animated.View>

            {/* Mic section */}
            <Animated.View
                style={[
                    styles.micSection,
                    {
                        bottom: insets.bottom + TAB_BAR_HEIGHT + 24,
                        opacity: Animated.multiply(micOpacity, micSectionOpacity),
                        transform: [{ translateY: micTranslateY }],
                    },
                ]}
                pointerEvents={hasPreview || hasDeletePreview ? "none" : "auto"}
            >
                {!transcription || recognizing ? (
                    <ThemedText
                        style={[
                            styles.listeningLabel,
                            {
                                color: recognizing
                                    ? "rgba(255,255,255,0.85)"
                                    : "rgba(255,255,255,0.55)",
                            },
                        ]}
                    >
                        {recognizing ? "Now Listening" : "Tap to Speak"}
                    </ThemedText>
                ) : null}
                <Animated.View style={{ transform: [{ scale: micScale }] }}>
                    <TouchableOpacity
                        onPress={
                            transcription && !recognizing
                                ? handleRetry
                                : recognizing
                                    ? handleStopRecording
                                    : handleMicPress
                        }
                        activeOpacity={0.85}
                        style={[
                            styles.micButton,
                            { backgroundColor: ThemedColor.primary },
                        ]}
                    >
                        <Ionicons
                            name={
                                transcription && !recognizing
                                    ? "reload"
                                    : recognizing
                                        ? "stop"
                                        : "mic"
                            }
                            size={28}
                            color="#ffffff"
                        />
                    </TouchableOpacity>
                </Animated.View>
            </Animated.View>

            {/* Generate / Done button */}
            {!hasPreview && !hasDeletePreview && (
                <Animated.View
                    style={[
                        styles.generateButtonWrapper,
                        {
                            bottom: insets.bottom + TAB_BAR_HEIGHT + 128,
                            opacity: generateBtnOpacity,
                            transform: [
                                {
                                    translateY: generateBtnOpacity.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [10, 0],
                                    }),
                                },
                            ],
                        },
                    ]}
                    pointerEvents={(transcription && !recognizing) || hasEditResult ? "auto" : "none"}
                >
                    <TouchableOpacity
                        onPress={hasEditResult ? dismissEditResult : handleProcessRequest}
                        style={[styles.generateButton, { backgroundColor: ThemedColor.primary }]}
                        activeOpacity={0.85}
                        disabled={isPreviewing}
                    >
                        <ThemedText style={styles.generateButtonText}>
                            {hasEditResult
                                ? currentOpIndex + 1 < pendingOpsCount ? "Next" : "Done"
                                : isPreviewing ? "Processing..." : "Process Request"}
                        </ThemedText>
                    </TouchableOpacity>
                </Animated.View>
            )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    overlayRoot: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 10000,
        elevation: 10000,
    },
    backgroundLayer: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 0,
    },
    contentLayer: {
        ...StyleSheet.absoluteFillObject,
        // Higher than touchInterceptor so interactive children (mic, close btn) win.
        zIndex: 2,
    },
    touchInterceptor: {
        ...StyleSheet.absoluteFillObject,
        // Must be lower than contentLayer so interactive elements (mic, close btn)
        // receive touches first; unfocused background taps fall through to this.
        zIndex: 1,
    },
    blurWrapper: {
        zIndex: 0,
    },
    dimOverlay: {
        backgroundColor: "rgba(0,0,0,0.25)",
    },
    gradientWrapper: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: GRADIENT_HEIGHT,
        zIndex: 1,
    },
    closeButton: {
        position: "absolute",
        right: 20,
        zIndex: 9999,
    },
    closeButtonInner: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: "rgba(255,255,255,0.15)",
        alignItems: "center",
        justifyContent: "center",
    },
    previewSection: {
        position: "absolute",
        left: 24,
        right: 24,
        zIndex: 9999,
        gap: 12,
    },
    previewLabelRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    previewLabel: {
        fontSize: 11,
        fontWeight: "600",
        color: "rgba(255,255,255,0.45)",
        letterSpacing: 1.2,
        textTransform: "uppercase",
    },
    stepCounter: {
        fontSize: 11,
        fontWeight: "600",
        color: "rgba(255,255,255,0.25)",
        letterSpacing: 0.6,
    },
    errorBanner: {
        marginTop: 10,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 10,
        backgroundColor: "rgba(255,90,90,0.18)",
        borderWidth: 1,
        borderColor: "rgba(255,120,120,0.35)",
        gap: 4,
    },
    errorBannerTitle: {
        fontSize: 13,
        fontWeight: "700",
        color: "#ffffff",
    },
    errorBannerText: {
        fontSize: 12,
        fontWeight: "500",
        color: "rgba(255,255,255,0.85)",
    },
    transcriptionText: {
        fontSize: 18,
        lineHeight: 28,
        color: "#ffffff",
        fontWeight: "500",
    },
    transcriptionWord: {
        color: "#ffffff",
    },
    placeholderText: {
        fontSize: 16,
        lineHeight: 24,
        color: "rgba(255,255,255,0.4)",
    },
    previewListWrapper: {
        position: "absolute",
        left: 24,
        right: 24,
        maxHeight: SCREEN_HEIGHT * 0.45,
        zIndex: 9999,
    },
    previewListContent: {
        paddingBottom: 12,
        gap: 18,
    },
    previewCategory: {
        gap: 10,
    },
    previewCategoryHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
    },
    previewCategoryTitle: {
        fontSize: 20,
        fontWeight: "600",
        letterSpacing: -0.5,
        color: "#ffffff",
    },
    previewNewBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    previewNewBadgeText: {
        fontSize: 10,
        fontWeight: "600",
        letterSpacing: 0.8,
    },
    previewWorkspaceLabel: {
        fontSize: 12,
        fontWeight: "600",
        letterSpacing: 0.6,
        textTransform: "uppercase",
        color: "rgba(255,255,255,0.55)",
    },
    previewTasks: {
        gap: 12,
    },
    generateButtonWrapper: {
        position: "absolute",
        left: 24,
        right: 24,
        marginTop: 12,
        marginBottom: 12,
        zIndex: 9999,
    },
    generateButton: {
        height: 52,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    generateButtonText: {
        fontSize: 16,
        fontWeight: "600",
        color: "#ffffff",
    },
    stopPillWrapper: {
        position: "absolute",
        left: 0,
        right: 0,
        alignItems: "center",
        zIndex: 9999,
    },
    stopPill: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: "rgba(255,255,255,0.15)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.2)",
    },
    stopPillText: {
        fontSize: 14,
        fontWeight: "500",
        color: "#ffffff",
    },
    micSection: {
        position: "absolute",
        left: 0,
        right: 0,
        alignItems: "center",
        zIndex: 9999,
    },
    listeningLabel: {
        fontSize: 15,
        fontWeight: "500",
        letterSpacing: 0.2,
    },
    micButton: {
        width: 64,
        height: 64,
        borderRadius: 36,
        marginTop: 12,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 10,
    },
    editResultTaskName: {
        fontSize: 16,
        lineHeight: 24,
        color: "rgba(255,255,255,0.6)",
        fontWeight: "400",
    },
    editResultRecurringTag: {
        fontSize: 14,
        color: "rgba(255,255,255,0.35)",
        fontWeight: "400",
    },
    // ─── Delete preview ──────────────────────────────────────────────────────
    deleteListContent: {
        gap: 8,
        paddingBottom: 16,
    },
    deleteSubtitle: {
        fontSize: 20,
        fontWeight: "500",
        color: "rgba(255,255,255,0.65)",
        lineHeight: 28,
        marginBottom: 8,
    },
    deleteTaskRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 12,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
        backgroundColor: "rgba(255,255,255,0.05)",
    },
    deleteTaskRowSelected: {
        backgroundColor: "rgba(239,68,68,0.1)",
        borderColor: "rgba(239,68,68,0.28)",
    },
    deleteCheckbox: {
        width: 20,
        height: 20,
        borderRadius: 5,
        borderWidth: 1.5,
        borderColor: "rgba(255,255,255,0.3)",
        backgroundColor: "transparent",
        alignItems: "center",
        justifyContent: "center",
        marginTop: 1,
        flexShrink: 0,
    },
    deleteCheckboxChecked: {
        borderColor: "rgba(239,68,68,0.9)",
        backgroundColor: "rgba(239,68,68,0.85)",
    },
    deleteTaskInfo: {
        flex: 1,
        gap: 4,
    },
    deleteTaskContent: {
        fontSize: 15,
        fontWeight: "500",
        lineHeight: 21,
        color: "#ffffff",
    },
    deleteTaskMeta: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    deleteMetaText: {
        fontSize: 12,
        color: "rgba(255,255,255,0.4)",
        fontWeight: "500",
    },
    deleteActionsWrapper: {
        position: "absolute",
        left: 24,
        right: 24,
        flexDirection: "row",
        gap: 10,
        zIndex: 9999,
    },
    deleteSkipBtn: {
        flex: 1,
        height: 52,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.18)",
    },
    deleteSkipBtnText: {
        fontSize: 15,
        fontWeight: "600",
        color: "rgba(255,255,255,0.6)",
    },
    deleteConfirmBtn: {
        flex: 2,
        height: 52,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(239,68,68,0.9)",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    deleteConfirmBtnDisabled: {
        backgroundColor: "rgba(239,68,68,0.35)",
    },
    deleteConfirmBtnText: {
        fontSize: 15,
        fontWeight: "600",
        color: "#ffffff",
    },
});

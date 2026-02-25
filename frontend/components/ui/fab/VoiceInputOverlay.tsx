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
import {
    previewTasksFromNaturalLanguageAPI,
    confirmTasksFromNaturalLanguageAPI,
    queryTasksNaturalLanguageAPI,
} from "@/api/task";
import type { components } from "@/api/generated/types";
import type { Task } from "@/api/types";
import DeletePreviewModal from "@/components/modals/DeletePreviewModal";
import TaskCard from "@/components/cards/TaskCard";

const { height: SCREEN_HEIGHT } = Dimensions.get("screen");
const TAB_BAR_HEIGHT = 83;
const GRADIENT_HEIGHT = SCREEN_HEIGHT * 0.65;
const DEV_FALLBACK_TRANSCRIPTION = "shovel the snow at noon tomorrow";

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
    const [isPreviewing, setIsPreviewing] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);
    const [previewPayload, setPreviewPayload] = useState<components["schemas"]["PreviewTaskNaturalLanguageOutputBody"] | null>(null);
    const [errorTitle, setErrorTitle] = useState("");
    const [errorDetails, setErrorDetails] = useState<string[]>([]);

    // Delete flow state
    const [deletePreviewTasks, setDeletePreviewTasks] = useState<components["schemas"]["TaskDocument"][]>([]);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    const hasPreview = previewPayload !== null;
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
    const micOpacity = useRef(new Animated.Value(0)).current;
    const micTranslateY = useRef(new Animated.Value(25)).current;
    const closeBtnOpacity = useRef(new Animated.Value(0)).current;
    const generateBtnOpacity = useRef(new Animated.Value(0)).current;
    const stopPillOpacity = useRef(new Animated.Value(0)).current;
    const stopPillTranslateY = useRef(new Animated.Value(8)).current;
    const micScale = useRef(new Animated.Value(1)).current;
    const readingProgress = useRef(new Animated.Value(0)).current;

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
        ]).start();
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
        if (__DEV__ && !ENABLE_SPEECH_RECOGNITION) {
            setTranscription(DEV_FALLBACK_TRANSCRIPTION);
        }
        return () => {
            if (recognizingRef.current && ExpoSpeechRecognitionModule) {
                ExpoSpeechRecognitionModule.stop();
            }
        };
    }, []);

    // ─── Generate button visibility ────────────────────────────────────────────

    useEffect(() => {
        if (hasPreview) {
            Animated.timing(generateBtnOpacity, {
                toValue: 1,
                duration: 250,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true,
            }).start();
            return;
        }
        if (transcription && !recognizing) {
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
    }, [transcription, recognizing, hasPreview]);

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

    // ─── Speech recognition events ────────────────────────────────────────────

    const clearError = () => {
        setErrorTitle("");
        setErrorDetails([]);
    };

    const setErrorFromModel = (error: unknown, fallbackTitle: string, fallbackDetail: string) => {
        const fallbackDetails = fallbackDetail ? [fallbackDetail] : [];
        let model: components["schemas"]["ErrorModel"] | null = null;

        if (error instanceof Error) {
            try {
                model = JSON.parse(error.message);
            } catch {
                // ignore parse errors; use fallback
            }
        } else if (error && typeof error === "object") {
            model = error as components["schemas"]["ErrorModel"];
        }

        const title = model?.title || fallbackTitle;
        const details: string[] = [];

        if (model?.detail) details.push(model.detail);
        if (Array.isArray(model?.errors)) {
            model.errors.forEach((item) => {
                if (item?.message) details.push(item.message);
            });
        }

        setErrorTitle(title);
        setErrorDetails(details.length > 0 ? details : fallbackDetails);
    };

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
        setErrorTitle("Voice Input Failed");
        setErrorDetails(["Try again or type a request."]);
    });

    // ─── Handlers ─────────────────────────────────────────────────────────────

    const handleMicPress = async () => {
        if (!ENABLE_SPEECH_RECOGNITION || !ExpoSpeechRecognitionModule) {
            return;
        }
        if (recognizing) {
            ExpoSpeechRecognitionModule.stop();
            return;
        }
        const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        if (!result.granted) {
            setErrorTitle("Microphone Permission Denied");
            setErrorDetails(["Enable microphone access in Settings."]);
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

    const handleClose = () => {
        if (isClosingRef.current) return;
        isClosingRef.current = true;
        if (recognizingRef.current && ExpoSpeechRecognitionModule) {
            ExpoSpeechRecognitionModule.stop();
        }
        // Animate out fully, THEN tell the parent to unmount us.
        // The parent's conditional render ({voiceOverlayVisible && <VoiceInputOverlay/>})
        // means the unmount happens after everything is already at opacity 0 — no snap.
        animateOut(() => {
            setPreviewPayload(null);
            setIsPreviewing(false);
            setIsConfirming(false);
            setTranscription("");
            clearError();
            onClose();
        });
    };

    const isDeleteIntent = (text: string) => /\b(delete|remove|clear)\b/i.test(text);

    const handleGeneratePreview = async () => {
        if (transcription.trim().length < 4 || isPreviewing || isConfirming) return;
        clearError();

        if (isDeleteIntent(transcription.trim())) {
            setIsPreviewing(true);
            try {
                const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                const result = await queryTasksNaturalLanguageAPI(transcription.trim(), timezone);
                setDeletePreviewTasks(result.tasks);
                setShowDeleteModal(true);
            } catch (error) {
                setErrorFromModel(error, "Couldn't Find Tasks", "Please try again.");
            } finally {
                setIsPreviewing(false);
            }
            return;
        }

        setIsPreviewing(true);
        try {
            const result = await previewTasksFromNaturalLanguageAPI(transcription.trim());
            setPreviewPayload(result);
        } catch (error) {
            setIsPreviewing(false);
            setErrorFromModel(error, "Couldn't Generate Tasks", "Please try again.");
            return;
        }
        setIsPreviewing(false);
    };

    const handleConfirmTasks = async () => {
        if (!previewPayload || isConfirming) return;
        clearError();
        setIsConfirming(true);
        try {
            await confirmTasksFromNaturalLanguageAPI(previewPayload);
            fetchWorkspaces(true);
            animateOut(() => {
                setPreviewPayload(null);
                setIsPreviewing(false);
                setIsConfirming(false);
                setTranscription("");
                clearError();
                onClose();
            });
        } catch (error) {
            setIsConfirming(false);
            setErrorFromModel(error, "Couldn't Add Tasks", "Please try again.");
        }
    };

    const handleRetry = () => {
        setPreviewPayload(null);
        setTranscription("");
        setIsPreviewing(false);
        setIsConfirming(false);
        clearError();
    };

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

    const handleDeleteModalClose = () => {
        setShowDeleteModal(false);
        setDeletePreviewTasks([]);
    };

    const handleDeleteConfirmed = () => {
        fetchWorkspaces(true);
        setShowDeleteModal(false);
        setDeletePreviewTasks([]);
        handleClose();
    };

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {/* Intercept background touches and dismiss */}
            <Pressable
                onPress={handleClose}
                style={styles.touchInterceptor}
                pointerEvents="auto"
            />

            {/* Blurred full-screen backdrop */}
            <Animated.View
                style={[StyleSheet.absoluteFill, styles.blurWrapper, { opacity: backdropOpacity }]}
                pointerEvents="none"
            >
                <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFill} />
                <View style={[StyleSheet.absoluteFill, styles.dimOverlay]} />
            </Animated.View>

            {/* Dark gradient from top */}
            <Animated.View
                style={[styles.gradientWrapper, { opacity: gradientOpacity }]}
                pointerEvents="none"
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
                <ThemedText style={styles.previewLabel}>Preview</ThemedText>
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
                {!hasPreview && (
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
                            <ThemedText style={styles.placeholderText}>
                                {recognizing
                                    ? "Listening for your voice..."
                                    : "Your transcription will appear here..."}
                            </ThemedText>
                        )}
                    </>
                )}
            </Animated.View>
            {hasPreview && (
                <Animated.View
                    style={[
                        styles.previewListWrapper,
                        {
                            top: insets.top + 112,
                            opacity: previewOpacity,
                            transform: [{ translateY: previewTranslateY }],
                        },
                    ]}
                    pointerEvents="auto"
                >
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.previewListContent}
                    >
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
                        onPress={handleClose}
                        style={[styles.generateButton, { backgroundColor: ThemedColor.primary }]}
                        activeOpacity={0.85}
                    >
                        <ThemedText style={styles.generateButtonText}>Done</ThemedText>
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
                        opacity: micOpacity,
                        transform: [{ translateY: micTranslateY }],
                    },
                ]}
                pointerEvents={hasPreview ? "none" : "auto"}
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

            {/* Delete preview modal */}
            <DeletePreviewModal
                visible={showDeleteModal}
                tasks={deletePreviewTasks}
                onClose={handleDeleteModalClose}
                onDeleted={handleDeleteConfirmed}
            />

            {/* Generate button */}
            {!hasPreview && (
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
                    pointerEvents={transcription && !recognizing ? "auto" : "none"}
                >
                    <TouchableOpacity
                        onPress={handleGeneratePreview}
                        style={[styles.generateButton, { backgroundColor: ThemedColor.primary }]}
                        activeOpacity={0.85}
                        disabled={isPreviewing}
                    >
                        <ThemedText style={styles.generateButtonText}>
                            {isPreviewing
                                ? isDeleteIntent(transcription) ? "Finding Tasks..." : "Generating..."
                                : isDeleteIntent(transcription) ? "Find Tasks to Delete" : "Generate Tasks"}
                        </ThemedText>
                    </TouchableOpacity>
                </Animated.View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    touchInterceptor: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 9996,
    },
    blurWrapper: {
        zIndex: 9997,
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
        zIndex: 9998,
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
    previewLabel: {
        fontSize: 11,
        fontWeight: "600",
        color: "rgba(255,255,255,0.45)",
        letterSpacing: 1.2,
        textTransform: "uppercase",
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
        color: "rgba(255,255,255,0.35)",
        fontStyle: "italic",
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
});

import React, { useEffect, useMemo, useState, useRef } from "react";
import { TouchableOpacity, View, StyleSheet, Dimensions } from "react-native";
import { ThemedText } from "../ThemedText";
import { useRouter } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";
import EditPost from "../modals/edit/EditPost";
import { Task } from "@/api/types";
import Svg, { Circle, Rect, Path } from "react-native-svg";
import ConditionalView from "../ui/ConditionalView";
import { useTasks } from "@/contexts/tasksContext";
import { useDebounce } from "@/hooks/useDebounce";
import EncourageModal from "../modals/EncourageModal";
import CongratulateModal from "../modals/CongratulateModal";
import { isAfter, formatDistanceToNow, parseISO, isBefore, isToday, isTomorrow, differenceInDays } from "date-fns";
import { AttachStep } from "react-native-spotlight-tour";
import { Sparkle, Timer, Repeat } from "phosphor-react-native";
import { getIntegrationIcon } from "@/utils/integrationUtils";
import CustomAlert, { AlertButton } from "@/components/modals/CustomAlert";

export const PRIORITY_MAP = {
    0: "none",
    1: "low",
    2: "medium",
    3: "high",
} as const;

type Priority = keyof typeof PRIORITY_MAP;
type PriorityLevel = (typeof PRIORITY_MAP)[Priority];

interface Props {
    content: string;
    value: number;
    priority: Priority;
    redirect?: boolean;
    encourage?: boolean;
    congratulate?: boolean;
    id: string;
    categoryId: string;
    task?: Task;
    height?: number;
    showRedOutline?: boolean; // Add red outline when categoryId is not configured
    detailed?: boolean; // Controls whether to show date labels like "(today)" or "(tomorrow)"
    inlineComponent?: React.ReactNode; // Optional component to render inline below the content text
    highlightContent?: boolean; // Whether to highlight just the task content text
    encouragementConfig?: {
        userHandle?: string;
        receiverId: string;
        categoryName: string;
    };
    congratulationConfig?: {
        userHandle?: string;
        receiverId: string;
        categoryName: string;
    };
}

const TaskCard = ({
    content,
    value,
    priority,
    redirect = false,
    inlineComponent,
    id,
    categoryId,
    encourage = false,
    congratulate = false,
    task,
    height = Dimensions.get("window").height * 0.07,
    showRedOutline = false,
    detailed = true,
    highlightContent = false,
    encouragementConfig,
    congratulationConfig,
}: Props) => {
    const router = useRouter();
    const [editing, setEditing] = useState(false);
    const [showEncourageModal, setShowEncourageModal] = useState(false);
    const [showCongratulateModal, setShowCongratulateModal] = useState(false);
    const ThemedColor = useThemeColor();
    const { setTask } = useTasks();
    const [isRunningState, setIsRunningState] = useState(false);
    const isMounted = useRef(true);

    // Alert state
    const [alertVisible, setAlertVisible] = useState(false);
    const [alertTitle, setAlertTitle] = useState("");
    const [alertMessage, setAlertMessage] = useState("");
    const [alertButtons, setAlertButtons] = useState<AlertButton[]>([]);

    const debouncedRedirect = useDebounce(() => {
        if (!redirect) return;
        router.push({
            pathname: "/(logged-in)/(tabs)/(task)/task/[id]",
            params: { name: content, id: id, categoryId: categoryId },
        });
    }, 200);

    useEffect(() => {
        return () => {
            isMounted.current = false;
        };
    }, []);

    // Timer state check removed for performance - was unused

    // Calculate date display text and color
    const dateDisplay = useMemo(() => {
        // If detailed is false, don't show any date labels
        if (!detailed) return null;

        const now = new Date();

        // Priority 1: Show deadline if it exists
        if (task?.deadline) {
            try {
                const deadlineDate = parseISO(task.deadline);
                const isOverdue = isAfter(now, deadlineDate);

                if (isOverdue) {
                    const duration = formatDistanceToNow(deadlineDate, { addSuffix: false });
                    return {
                        text: `Due ${duration} ago`,
                        color: 'error' as const
                    };
                } else {
                    // Format: "due in X days"
                    let text = formatDistanceToNow(deadlineDate, { addSuffix: true });
                    // Replace "in" with "due in"
                    text = text.replace(/^in /, 'due in ');
                    return {
                        text: `(${text})`,
                        color: 'caption' as const
                    };
                }
            } catch (error) {
                console.error("Error parsing deadline:", error);
                return null;
            }
        }

        // Priority 2: Show start date if it exists and no deadline
        if (task?.startDate && !task?.deadline) {
            try {
                const startDate = parseISO(task.startDate);

                if (isToday(startDate)) {
                    return {
                        text: '(today)',
                        color: 'caption' as const
                    };
                } else if (isTomorrow(startDate)) {
                    return {
                        text: '(tomorrow)',
                        color: 'caption' as const
                    };
                } else if (isAfter(now, startDate)) {
                    // Start date was in the past
                    const duration = formatDistanceToNow(startDate, { addSuffix: false });
                    return {
                        text: `(${duration} ago)`,
                        color: 'caption' as const
                    };
                } else {
                    // Start date is in the future
                    const duration = formatDistanceToNow(startDate, { addSuffix: true });
                    return {
                        text: `(${duration})`,
                        color: 'caption' as const
                    };
                }
            } catch (error) {
                console.error("Error parsing start date:", error);
                return null;
            }
        }

        return null;
    }, [task?.deadline, task?.startDate, detailed]);

    const getPriorityColor = (level: PriorityLevel) => {
        switch (level) {
            case "none":
                return ThemedColor.disabled + "00";
            case "low":
                return ThemedColor.success;
            case "medium":
                return ThemedColor.warning;
            case "high":
                return ThemedColor.error;
        }
    };

    const handlePress = () => {
        if (encourage) {
            if (!encouragementConfig?.receiverId || encouragementConfig.receiverId.trim() === "") {
                console.error("Cannot show encourage modal: missing receiverId");
                setAlertTitle("Error");
                setAlertMessage("Unable to send encouragement at this time. Please try again later.");
                setAlertButtons([{ text: "OK", style: "default" }]);
                setAlertVisible(true);
                return;
            }
            console.log("Encourage button pressed, showing modal");
            setShowEncourageModal(true);
        }
        if (congratulate) {
            if (!congratulationConfig?.receiverId || congratulationConfig.receiverId.trim() === "") {
                console.error("Cannot show congratulate modal: missing receiverId");
                setAlertTitle("Error");
                setAlertMessage("Unable to send congratulation at this time. Please try again later.");
                setAlertButtons([{ text: "OK", style: "default" }]);
                setAlertVisible(true);
                return;
            }
            console.log("Congratulate button pressed, showing modal");
            setShowCongratulateModal(true);
        }
        if (task) {
            setTask(task);
            debouncedRedirect();
        } else {
            // theres some error
        }
    };

    const handleLongPress = () => {
        if (redirect) setEditing(true);
    };

    return (
        <>
            <TouchableOpacity
                style={[
                    styles.container,
                    {
                        backgroundColor: ThemedColor.lightenedCard,
                        borderWidth: 1,
                        borderColor: ThemedColor.tertiary,
                        // borderRightColor: ThemedColor.primary,
                        // borderRightWidth: 2,
                        // borderTopRightRadius: 4,
                        // borderBottomRightRadius: 4,
                    },
                ]}
                disabled={!redirect && !encourage && !congratulate}
                onPress={handlePress}
                onLongPress={handleLongPress}>
                {editing && <EditPost visible={editing} setVisible={setEditing} id={{ id, category: categoryId }} />}

                <View style={styles.row}>
                    <View style={styles.contentContainer}>
                        {highlightContent ? (
                            <AttachStep index={1}>
                                <ThemedText numberOfLines={2} ellipsizeMode="tail" style={styles.content} type="default">
                                    {content}
                                    {dateDisplay && (
                                        <ThemedText type="default" style={{ color: ThemedColor[dateDisplay.color] }}>
                                            {" "}{dateDisplay.text}
                                        </ThemedText>
                                    )}
                                </ThemedText>
                            </AttachStep>
                        ) : (
                            <ThemedText numberOfLines={2} ellipsizeMode="tail" style={styles.content} type="default">
                                {content}
                                {dateDisplay && (
                                    <ThemedText type="default" style={{ color: ThemedColor[dateDisplay.color] }}>
                                        {" "}{dateDisplay.text}
                                    </ThemedText>
                                )}
                            </ThemedText>
                        )}
                        {inlineComponent && <View style={styles.inlineWrapper}>{inlineComponent}</View>}
                    </View>
                    <View style={styles.iconRow}>
                        <ConditionalView condition={!encourage}>
                            <ConditionalView condition={isRunningState}>
                                <Timer size={20} color={ThemedColor.caption} weight="regular" />
                            </ConditionalView>
                            <ConditionalView condition={task?.recurring}>
                                <Repeat size={20} color={ThemedColor.caption} weight="regular" />
                            </ConditionalView>
                            <ConditionalView condition={!!task?.integration}>
                                {getIntegrationIcon(task?.integration, ThemedColor.caption)}
                            </ConditionalView>
                            {/* <ThemedText type="caption" style={{ color: ThemedColor.caption }}>
                            {value}
                        </ThemedText> */}

                            {/* Show priority dot */}
                            <View
                                style={[styles.circle, { backgroundColor: getPriorityColor(PRIORITY_MAP[priority]) }]}
                            />
                        </ConditionalView>
                        <ConditionalView condition={encourage}>
                            <Sparkle
                                size={24}
                                color="#9333EA"
                                weight="regular"
                            />
                        </ConditionalView>
                        <ConditionalView condition={congratulate}>
                            <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                <Path
                                    d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z"
                                    fill="#FFD700"
                                />
                            </Svg>
                        </ConditionalView>
                    </View>
                </View>
            </TouchableOpacity>

            {/* Lazy load modals - only render when needed */}
            {showEncourageModal && (
                <EncourageModal
                    visible={showEncourageModal}
                    setVisible={setShowEncourageModal}
                    task={{
                        id,
                        content,
                        value,
                        priority,
                        categoryId,
                    }}
                    encouragementConfig={encouragementConfig}
                />
            )}

            {showCongratulateModal && (
                <CongratulateModal
                    visible={showCongratulateModal}
                    setVisible={setShowCongratulateModal}
                    task={{
                        id,
                        content,
                        value,
                        priority,
                        categoryId,
                    }}
                    congratulationConfig={congratulationConfig}
                />
            )}

            {alertVisible && (
                <CustomAlert
                    visible={alertVisible}
                    setVisible={setAlertVisible}
                    title={alertTitle}
                    message={alertMessage}
                    buttons={alertButtons}
                />
            )}
        </>
    );
};

// Memoize TaskCard to prevent unnecessary re-renders
export default React.memo(TaskCard, (prevProps, nextProps) => {
    // Only re-render if these specific props change
    return (
        prevProps.content === nextProps.content &&
        prevProps.id === nextProps.id &&
        prevProps.priority === nextProps.priority &&
        prevProps.value === nextProps.value &&
        prevProps.redirect === nextProps.redirect &&
        prevProps.encourage === nextProps.encourage &&
        prevProps.congratulate === nextProps.congratulate &&
        prevProps.showRedOutline === nextProps.showRedOutline &&
        prevProps.detailed === nextProps.detailed &&
        prevProps.highlightContent === nextProps.highlightContent &&
        prevProps.task?.deadline === nextProps.task?.deadline &&
        prevProps.task?.startDate === nextProps.task?.startDate &&
        prevProps.task?.startTime === nextProps.task?.startTime &&
        prevProps.task?.active === nextProps.task?.active &&
        prevProps.task?.recurring === nextProps.task?.recurring &&
        prevProps.task?.integration === nextProps.task?.integration
    );
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderRadius: 16,
        justifyContent: "center",
    },
    row: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 6,
        minHeight: 20,
    },
    circle: {
        width: 10,
        height: 10,
        borderRadius: 10,
    },
    contentContainer: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        width: "90%",
        margin: "auto",
        gap: 6,
    },
    content: {
        textAlign: "left",
        lineHeight: 24,
    },
    inlineWrapper: {
        marginTop: 2,
    },
    iconRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        minHeight: 20,
        height: "100%"
    },
});

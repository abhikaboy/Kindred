import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    Animated,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
    useColorScheme,
    useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Reanimated, {
    Easing,
    LinearTransition,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
    Barbell,
    Bell,
    CalendarBlank,
    CaretDown,
    Eye,
    EyeSlash,
    Flag,
    HourglassMedium,
    MagnifyingGlass,
    Microphone,
    Plugs,
    Plus,
    Repeat,
    Sparkle,
    Stop,
    X,
    UsersThree,
    Planet,
} from "phosphor-react-native";
import { ObjectId } from "bson";
import { describeSchedule } from "@shared/taskSuggest";
import { ThemedText } from "@/components/ThemedText";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { SectionTitle } from "@/components/dashboard/SectionHeader";
import CachedImage from "@/components/CachedImage";
import { VoiceWaveform } from "@/components/ui/VoiceWaveform";
import TutorialCursor from "@/components/onboarding/TutorialCursor";
import { CaptureBackdrop, ON_DARK, ON_DARK_MUTED, SOFT_ENTER, STAGE } from "@/components/capture/CaptureStage";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useTaskSuggestions } from "@/hooks/useTaskSuggestions";
import { noAppliedSchedule, scheduleUpdates, type AppliedSchedule } from "@/hooks/scheduleUpdates";
import { useVoiceCapture } from "@/hooks/useVoiceCapture";
import { useInlineTrigger } from "@/hooks/useInlineTrigger";
import { useFriendsForMention, type MentionCandidate } from "@/hooks/useFriendsForMention";
import { AUTO_CATEGORY_ID, useSubmitNewTask } from "@/hooks/useSubmitNewTask";
import { useRequest } from "@/hooks/useRequest";
import { useTasks } from "@/contexts/tasksContext";
import { useTaskCreation } from "@/contexts/taskCreationContext";
import { useBlueprints } from "@/contexts/blueprintContext";
import CustomAlert, { type AlertButton } from "@/components/modals/CustomAlert";
import { useAnalytics } from "@/hooks/useAnalytics";
import { AnalyticsEvents } from "@/utils/analytics";
import type { Task } from "@/api/types";
import { clearTaskSomedayAPI, setTaskSomedayAPI } from "@/api/plan";
import { isSomedayTask } from "@/hooks/useSomedayTasks";
import { showToast } from "@/utils/showToast";
import { persistTaskEdit, persistTemplateEdit, buildBlueprintTask } from "./persistEdit";
import { formatHandle } from "@/utils/handle";
import { ONBOARDING_WORKSPACE } from "@/constants/spotlightConfig";
import { useOnboardingV2Context } from "@/contexts/OnboardingV2Context";
import CategoryPicker, { categoryColor } from "./CategoryPicker";
import PropertyChip, { type ChipState } from "./PropertyChip";
import QuickSet from "./QuickSet";
import RepeatPanel from "./RepeatPanel";
import DatePanel from "./DatePanel";
import TagPanel from "./TagPanel";
import ReminderPanel from "./ReminderPanel";
import IntegrationPanel from "./IntegrationPanel";
import { listCategories, rankCategories, type CategoryOption } from "./categoryOptions";

export type Panel = "start" | "due" | "repeat" | "priority" | "difficulty" | "reminder" | "tag" | "integration";

const FADE = { duration: 220, easing: Easing.out(Easing.cubic) };
const ROW_TRANSITION = LinearTransition.duration(200).easing(Easing.out(Easing.cubic));
const PRIORITY_LABEL: Record<number, string> = { 1: "Low", 2: "Medium", 3: "High" };
// Backend accepts 0-10
const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
// Small enough to sit above the keyboard; the rest drop it for room
const KEEPS_KEYBOARD: Panel[] = ["priority", "difficulty"];

const fmtDay = (d: Date) => d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
const fmtTime = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

interface Props {
    visible: boolean;
    setVisible: (visible: boolean) => void;
    /** Opens filed here; AUTO_CATEGORY_ID or nothing opens on Auto Sort. */
    categoryId?: string;
    /**
     * Onboarding: the caller types the title in, so it's read-only with no
     * keyboard, no "@", mic, suggestions or picker; the category stays on
     * categoryId, and a cursor points at Add once the title settles.
     */
    tutorial?: boolean;
    /** Tutorial only: workspace name shown on the locked destination card. */
    tutorialWorkspaceLabel?: string;
    /** Edit the task loaded into the creation context instead of adding one. */
    edit?: boolean;
    /** Edit only: the task being saved; falls back to the tasks context's task. */
    editTask?: Task | null;
    /** Files into the blueprint being built (local only) rather than a workspace. */
    isBlueprint?: boolean;
    /** Opens with this property's panel showing. */
    initialPanel?: Panel;
}

// The caller's typewriter ticks faster than this, so a pause means it's done
const TUTORIAL_TITLE_SETTLE_MS = 600;

/**
 * Full-screen create stage, built from quick capture's parts. Bottom up: the
 * keyboard (or the panel for whichever property is being edited), the
 * destination row with Add, one chip per property, and the title.
 *
 * Each chip is empty, suggested (a guess from the title, tap to accept) or
 * set. Typing "@" in the title turns the chip rail into friends to tag.
 * Task fields live in the task-creation context, so the old sheet's
 * screens drop straight into the panels.
 */
export default function CreateComposer({
    visible,
    setVisible,
    categoryId,
    tutorial = false,
    tutorialWorkspaceLabel,
    edit = false,
    editTask,
    isBlueprint = false,
    initialPanel,
}: Props) {
    const ThemedColor = useThemeColor();
    // Follows the app's theme setting (applied through Appearance)
    const scheme = useColorScheme() === "dark" ? "dark" : "light";
    const styles = useMemo(() => makeStyles(ThemedColor), [ThemedColor]);
    const insets = useSafeAreaInsets();
    const { workspaces, selected, addToWorkspace, updateTask, task: contextTask } = useTasks();
    const { blueprintCategories, addBlueprintCategory, addTaskToBlueprintCategory } = useBlueprints();
    const { capture } = useAnalytics();
    const [alert, setAlert] = useState<{ title: string; message: string; buttons: AlertButton[] } | null>(null);
    const { request } = useRequest();
    const submitNewTask = useSubmitNewTask();
    const { dispatch: dispatchOnboarding } = useOnboardingV2Context();
    const { filter: filterFriends } = useFriendsForMention();
    const {
        taskName,
        setTaskName,
        priority,
        setPriority,
        value,
        setValue,
        recurring,
        setRecurring,
        recurFrequency,
        setRecurFrequency,
        recurDetails,
        setRecurDetails,
        flexDetails,
        setFlexDetails,
        deadline,
        setDeadline,
        startDate,
        setStartDate,
        startTime,
        setStartTime,
        reminders,
        remindersAuto,
        setReminders,
        isPublic,
        setIsPublic,
        integration,
        setIntegration,
        taggedUsers,
        setTaggedUsers,
        setCopySourceTaskId,
        setIsBlueprint,
        resetTaskCreation,
    } = useTaskCreation();
    const creation = useTaskCreation();
    const creationRef = useRef(creation);
    creationRef.current = creation;

    const [mounted, setMounted] = useState(visible);
    const opacity = useSharedValue(0);
    const closingRef = useRef(false);
    const inputRef = useRef<TextInput>(null);
    const searchRef = useRef<TextInput>(null);
    const [keyboardUp, setKeyboardUp] = useState(false);

    // Only one of these owns the space under the rows at a time
    const [panel, setPanelState] = useState<Panel | null>(null);
    const panelRef = useRef<Panel | null>(null);
    const [picking, setPickingState] = useState(false);
    const pickingRef = useRef(false);
    const [pickQuery, setPickQuery] = useState("");

    // null is Auto Sort
    const [category, setCategory] = useState<CategoryOption | null>(null);
    // Priority and difficulty always hold a value; these say whether anyone chose it
    const [touched, setTouched] = useState({ priority: false, value: false });
    const [applied, setApplied] = useState<AppliedSchedule>(noAppliedSchedule);

    const nameRef = useRef(taskName);
    nameRef.current = taskName;

    const options = useMemo(
        () =>
            isBlueprint
                ? blueprintCategories.map((c) => ({ id: c.id, name: c.name, workspace: "Blueprint" }))
                : listCategories(workspaces),
        [isBlueprint, blueprintCategories, workspaces]
    );
    // New categories land in the workspace being viewed, if it can hold one
    const homeWorkspace = isBlueprint
        ? "Blueprint"
        : (workspaces.find((w) => w.name === selected && !w.isBlueprint)?.name ??
          workspaces.find((w) => !w.isBlueprint)?.name ??
          "Personal");
    // Edits and blueprints file into a real category, so there's no Auto Sort
    const allowAuto = !edit && !isBlueprint;

    const {
        token: typedToken,
        onChangeText,
        onSelectionChange,
        replace: replaceToken,
    } = useInlineTrigger(taskName, setTaskName, ["@"]);
    // The tutorial title is typed for the user, so it never opens "@"
    // Tags only go out with a new task, so edits and blueprints never open "@" either
    const canTag = !tutorial && !edit && !isBlueprint;

    // Someday: an undated task, new or existing. Any date or repeat replaces it, since the server rejects the mix
    const [someday, setSomeday] = useState(false);
    const allowSomeday = !isBlueprint;
    useEffect(() => {
        if (visible) setSomeday(edit && isSomedayTask(editTask ?? contextTask));
    }, [visible]);
    useEffect(() => {
        if (startDate || deadline || recurring || flexDetails) setSomeday(false);
    }, [startDate, deadline, recurring, flexDetails]);
    const token = canTag ? typedToken : null;

    // An empty title keeps the tutorial free of guesses: no schedule, priority or category
    const { schedule, recurrence, fuzzy, dismiss } = useTaskSuggestions(tutorial || edit ? "" : taskName);
    const guess = fuzzy?.categoryId ? options.find((o) => o.id === fuzzy.categoryId) : undefined;

    const { listening, volume, toggleMic, cancelListening, voiceModeRef } = useVoiceCapture({
        text: taskName,
        setText: setTaskName,
        isClosing: () => closingRef.current,
        refocus: () => inputRef.current?.focus(),
    });

    const setPanel = (next: Panel | null) => {
        panelRef.current = next;
        setPanelState(next);
    };
    const setPicking = (next: boolean) => {
        pickingRef.current = next;
        setPickingState(next);
    };

    // ─── Open / close ────────────────────────────────────────────────────────

    useEffect(() => {
        if (!visible) {
            // Closed from outside: fade out like any other close
            if (mounted) close();
            return;
        }
        closingRef.current = false;
        setMounted(true);
        const opened =
            categoryId && categoryId !== AUTO_CATEGORY_ID
                ? (options.find((o) => o.id === categoryId) ?? { id: categoryId, name: "Category", workspace: "" })
                : null;
        setCategory(opened);
        // A prefilled task (copy, calendar) arrives with values someone chose
        setTouched(edit ? { priority: true, value: true } : { priority: priority !== 1, value: value !== 1 });
        // Same as the old sheet: blueprint mode picks its own default start date
        if (!edit) setIsBlueprint(isBlueprint);
        setPanel(initialPanel ?? null);
        opacity.value = withTiming(1, FADE);
        // Only opening resets this session; options/priority/value are read once
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);

    const finishClose = () => {
        // Reopened mid-fade: the interrupted fade-out must not unmount the new session
        if (!closingRef.current) return;
        setMounted(false);
        setPanel(null);
        setPicking(false);
        setPickQuery("");
        setApplied(noAppliedSchedule());
        // A cancelled copy must not mark the tag "copied" on a later create
        setCopySourceTaskId(null);
        // An edit's fields must not prefill the next new task
        if (edit) resetTaskCreation();
        setAlert(null);
        setVisible(false);
    };

    const close = () => {
        if (closingRef.current) return;
        closingRef.current = true;
        voiceModeRef.current = false;
        cancelListening();
        Keyboard.dismiss();
        // Unmount even if the fade is interrupted: a mounted modal at opacity 0
        // is invisible but still swallows every touch on the screen.
        opacity.value = withTiming(0, FADE, () => {
            runOnJS(finishClose)();
        });
    };

    // Lowering the keyboard with nothing typed means "never mind". With a title
    // it just uncovers the rows, and a panel or the mic dropping it isn't either.
    useEffect(() => {
        if (!mounted) return;
        // Only arm close-on-hide once this session's keyboard has fully shown, so
        // the hide iOS fires while presenting the modal can't knock us straight back out.
        let shown = false;
        const willShow = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => {
            setKeyboardUp(true);
            voiceModeRef.current = false;
        });
        const didShow = Keyboard.addListener("keyboardDidShow", () => {
            shown = true;
        });
        const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => {
            setKeyboardUp(false);
            // The tutorial never raises the keyboard, so a hide there is never "never mind"
            if (tutorial) return;
            if (!shown || voiceModeRef.current || panelRef.current || pickingRef.current) return;
            if (nameRef.current.trim() === "") close();
        });
        return () => {
            willShow.remove();
            didShow.remove();
            hide.remove();
        };
        // close reads refs only; re-subscribing per render would drop events
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mounted]);

    // ─── Schedule parsing ────────────────────────────────────────────────────

    // Same contract as the old sheet: the parser may rewrite only what it wrote
    useEffect(() => {
        const result = scheduleUpdates(
            { startDate, startTime, deadline, recurring, flexDetails },
            schedule,
            recurrence,
            applied
        );
        if (result.applied !== applied) setApplied(result.applied);
        const { update } = result;
        if (update.startDate) setStartDate(update.startDate);
        if (update.startTime) setStartTime(update.startTime);
        if (update.deadline) setDeadline(update.deadline);
        if (update.recurrence) {
            setRecurring(true);
            setRecurFrequency(update.recurrence.recurFrequency);
            setRecurDetails({ ...recurDetails, ...update.recurrence.recurDetails });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [schedule, recurrence]);

    // ─── Actions ─────────────────────────────────────────────────────────────

    // The tutorial title is read-only; focusing it would only raise a keyboard
    const focusTitle = () => {
        if (!tutorial) inputRef.current?.focus();
    };

    const openPanel = (next: Panel) => {
        if (panelRef.current === next) {
            // Second tap on the open chip goes back to typing
            setPanel(null);
            focusTitle();
            return;
        }
        cancelListening();
        setPanel(next);
        // Keep typing possible when the panel fits above the keyboard
        if (!KEEPS_KEYBOARD.includes(next)) Keyboard.dismiss();
    };

    const closePanel = () => {
        setPanel(null);
        focusTitle();
    };

    const startPicking = () => {
        cancelListening();
        setPanel(null);
        setPickQuery("");
        setPicking(true);
    };

    const stopPicking = () => {
        setPicking(false);
        setPickQuery("");
        focusTitle();
    };

    const pickCategory = (option: CategoryOption | null) => {
        Haptics.selectionAsync();
        setCategory(option);
    };

    const createCategory = async (name: string): Promise<CategoryOption | null> => {
        if (isBlueprint) {
            const id = new ObjectId().toString();
            addBlueprintCategory({
                id,
                name,
                workspaceName: selected || "Personal",
                lastEdited: new Date().toISOString(),
                tasks: [],
                user: "",
            });
            return { id, name, workspace: homeWorkspace };
        }
        try {
            const response = await request("POST", `/user/categories`, { name, workspaceName: homeWorkspace });
            addToWorkspace(homeWorkspace, response);
            if (homeWorkspace === ONBOARDING_WORKSPACE) dispatchOnboarding({ type: "CATEGORY_CREATED" });
            return { id: response.id, name, workspace: homeWorkspace };
        } catch (error) {
            console.error("Failed to create category:", error);
            const { showToastable } = await import("react-native-toastable");
            showToastable({
                title: "Couldn't create category",
                message: "Give it another try.",
                status: "danger",
                duration: 3000,
            });
            return null;
        }
    };

    const pickFriend = (friend: MentionCandidate) => {
        replaceToken(`${formatHandle(friend.handle)} `);
        if (taggedUsers.some((u) => u.id === friend.id)) return;
        setTaggedUsers([
            ...taggedUsers,
            {
                id: friend.id,
                handle: friend.handle,
                display_name: friend.display_name,
                profile_picture: friend.profile_picture,
            },
        ]);
    };

    const friendMatches = token?.char === "@" ? filterFriends(token.query).slice(0, 8) : [];

    const hasTitle = taskName.trim().length > 0;
    // An explicit pick wins; otherwise file where the guess says, like quick capture
    const destinationId = category?.id ?? guess?.id ?? AUTO_CATEGORY_ID;
    const taskToEdit = editTask ?? contextTask;

    // Someday is its own endpoint: it strips dates and plan server-side, so it runs after the field save
    const syncSomeday = (categoryId: string) => {
        if (someday === !!taskToEdit.somedayAt) return;
        updateTask(categoryId, taskToEdit.id, { somedayAt: someday ? new Date().toISOString() : null });
        const call = someday
            ? setTaskSomedayAPI(categoryId, taskToEdit.id)
            : clearTaskSomedayAPI(categoryId, taskToEdit.id);
        call.catch(() => showToast("Couldn't update Someday. Give it another try.", "danger"));
    };

    const saveEdit = () => {
        if (!taskToEdit) return close();
        // Auto Sort isn't offered here, so no pick means the task's own category
        const targetCategoryId = category?.id || taskToEdit.categoryID;
        const fields = creationRef.current;
        const persist = () =>
            persistTaskEdit(fields, taskToEdit, targetCategoryId, updateTask).then((ok) => {
                if (!ok) return;
                capture(AnalyticsEvents.TASK_UPDATED, { source: "edit_modal" });
                syncSomeday(targetCategoryId);
            });
        if (!taskToEdit.templateID) {
            persist();
            return close();
        }
        setAlert({
            title: "Update Recurring Task",
            message: "Do you want to update only this occurrence or all future tasks?",
            buttons: [
                {
                    text: "Only This Task",
                    onPress: () => {
                        persist();
                        close();
                    },
                },
                {
                    text: "All Future Tasks",
                    onPress: () => {
                        persist().then(() => persistTemplateEdit(fields, taskToEdit));
                        close();
                    },
                },
                { text: "Cancel", style: "cancel" },
            ],
        });
    };

    const submit = () => {
        if (!hasTitle || closingRef.current) return;
        // A blueprint task needs a blueprint category; send them to pick or make one
        if (isBlueprint && !category) return startPicking();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        cancelListening();
        if (edit) return saveEdit();
        if (isBlueprint && category) {
            addTaskToBlueprintCategory(category.id, buildBlueprintTask(creationRef.current, category.id));
            capture(AnalyticsEvents.TASK_CREATED, {
                source: "create_modal",
                has_deadline: !!deadline,
                has_checklist: false,
            });
            resetTaskCreation();
        } else {
            submitNewTask(destinationId, { someday: allowSomeday && someday });
        }
        close();
    };

    const onRequestClose = () => {
        if (pickingRef.current) stopPicking();
        else if (panelRef.current) closePanel();
        else close();
    };

    // ─── Chips ───────────────────────────────────────────────────────────────

    const startSet = startDate !== null;
    const dueSet = deadline !== null;
    const repeatSet = recurring || !!flexDetails;
    const suggestedPriority =
        !touched.priority && fuzzy?.priority && fuzzy.priority !== priority ? fuzzy.priority : undefined;
    const suggestedValue = !touched.value && fuzzy?.value ? Math.round(fuzzy.value) : undefined;
    const priorityColor = (p: number) =>
        p >= 3 ? ThemedColor.error : p === 2 ? ThemedColor.warning : ThemedColor.success;

    const state = (isSet: boolean, suggested?: unknown): ChipState =>
        isSet ? "set" : suggested !== undefined ? "suggested" : "empty";

    const repeatLabel = flexDetails
        ? `${flexDetails.target}x per ${flexDetails.period.replace("ly", "").replace("dai", "day")}`
        : recurring
          ? describeSchedule(null, { recurring: true, recurFrequency, recurDetails } as any) || recurFrequency
          : undefined;

    const chips = (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            contentContainerStyle={styles.rail}>
            {/* Core: when and how urgent, always labeled */}
            <PropertyChip
                tier="core"
                Icon={someday ? Planet : CalendarBlank}
                state={state(startSet || someday)}
                label={
                    someday
                      ? "Someday"
                      : startDate
                        ? startTime
                            ? `${fmtDay(startDate)}, ${fmtTime(startTime)}`
                            : fmtDay(startDate)
                        : "Start"
                }
                active={panel === "start"}
                onPress={() => openPanel("start")}
                onClear={() => {
                    dismiss();
                    setSomeday(false);
                    setStartDate(null);
                    setStartTime(null);
                }}
                accessibilityLabel="Start date"
            />
            <PropertyChip
                tier="core"
                Icon={HourglassMedium}
                state={state(dueSet)}
                label={deadline ? `Due ${fmtDay(deadline)}` : "Due"}
                active={panel === "due"}
                onPress={() => openPanel("due")}
                onClear={() => {
                    dismiss();
                    setDeadline(null);
                }}
                accessibilityLabel="Deadline"
            />
            {/* Always holds a value (Low by default), so it has no clear */}
            <PropertyChip
                tier="core"
                Icon={Flag}
                state={suggestedPriority ? "suggested" : "set"}
                label={PRIORITY_LABEL[suggestedPriority ?? priority]}
                iconColor={priorityColor(suggestedPriority ?? priority)}
                active={panel === "priority"}
                onPress={() => {
                    if (suggestedPriority) {
                        Haptics.selectionAsync();
                        setPriority(suggestedPriority);
                        setTouched((t) => ({ ...t, priority: true }));
                    } else openPanel("priority");
                }}
                accessibilityLabel="Priority"
            />

            <View style={[styles.divider, { backgroundColor: "rgba(255,255,255,0.2)" }]} />

            {/* Extras: bare icons until they hold something */}
            <PropertyChip
                tier="extra"
                Icon={Repeat}
                state={state(repeatSet)}
                label={repeatLabel}
                active={panel === "repeat"}
                onPress={() => openPanel("repeat")}
                onClear={() => {
                    dismiss();
                    setRecurring(false);
                    setFlexDetails(null);
                }}
                accessibilityLabel="Repeat"
            />
            <PropertyChip
                tier="extra"
                Icon={Bell}
                state={state(reminders.length > 0)}
                label={
                    reminders.length === 1
                        ? `${remindersAuto ? "Auto · " : ""}${fmtTime(reminders[0].triggerTime)}`
                        : reminders.length > 1
                          ? remindersAuto
                              ? "Auto reminders"
                              : `${reminders.length} reminders`
                          : undefined
                }
                active={panel === "reminder"}
                onPress={() => openPanel("reminder")}
                onClear={() => setReminders([])}
                accessibilityLabel="Reminder"
            />
            <PropertyChip
                tier="extra"
                Icon={Barbell}
                state={state(touched.value, suggestedValue)}
                label={touched.value ? `Level ${value}` : suggestedValue ? `Level ${suggestedValue}` : undefined}
                active={panel === "difficulty"}
                onPress={() => {
                    if (suggestedValue) {
                        Haptics.selectionAsync();
                        setValue(suggestedValue);
                        setTouched((t) => ({ ...t, value: true }));
                    } else openPanel("difficulty");
                }}
                onClear={() => {
                    setValue(1);
                    setTouched((t) => ({ ...t, value: false }));
                }}
                accessibilityLabel="Difficulty"
            />
            {canTag && (
                <PropertyChip
                    tier="extra"
                    Icon={UsersThree}
                    state={state(taggedUsers.length > 0)}
                    label={
                        taggedUsers.length === 1
                            ? formatHandle(taggedUsers[0].handle)
                            : taggedUsers.length > 1
                              ? `${taggedUsers.length} friends`
                              : undefined
                    }
                    active={panel === "tag"}
                    onPress={() => openPanel("tag")}
                    onClear={() => setTaggedUsers([])}
                    accessibilityLabel="Tag friends"
                />
            )}
            <PropertyChip
                tier="extra"
                Icon={Plugs}
                state={state(integration !== "")}
                label={integration ? integration.charAt(0).toUpperCase() + integration.slice(1) : undefined}
                active={panel === "integration"}
                onPress={() => openPanel("integration")}
                onClear={() => setIntegration("")}
                accessibilityLabel="Integration"
            />
        </ScrollView>
    );

    // Classic Kindred chip, on the dark stage
    // Flat white-alpha on the black scrim, the same in both themes
    const chipSurface = [styles.pill, { backgroundColor: STAGE.fill }];

    // "@" takes over the rail while the handle is being typed
    const friendRail = (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            contentContainerStyle={styles.rail}>
            {friendMatches.map((f) => (
                <TouchableOpacity
                    key={f.id}
                    onPress={() => pickFriend(f)}
                    accessibilityRole="button"
                    style={chipSurface}>
                    {f.profile_picture ? (
                        <CachedImage source={{ uri: f.profile_picture }} style={styles.avatar} />
                    ) : null}
                    <ThemedText type="lightBody" style={styles.pillText}>
                        {f.display_name}
                    </ThemedText>
                    <ThemedText type="caption" style={styles.pillCaption}>
                        {formatHandle(f.handle)}
                    </ThemedText>
                </TouchableOpacity>
            ))}
            {friendMatches.length === 0 && (
                <ThemedText type="caption" style={styles.onScrimCaption}>
                    No friends match
                </ThemedText>
            )}
        </ScrollView>
    );

    // ─── Destination row ─────────────────────────────────────────────────────

    // Second only to Add: a full-width card rather than a chip
    const destinationSurface = [styles.destination, { backgroundColor: STAGE.fillRaised }];
    const destination = category ?? guess;
    const destinationRow = tutorial ? (
        // Locked to the category the tutorial just made: shown, not pickable
        <View
            style={destinationSurface}
            accessible
            accessibilityLabel={category ? `Category: ${category.name}` : "Category"}>
            <View
                style={[
                    styles.destinationBar,
                    { backgroundColor: category ? categoryColor(category, "dark") : STAGE.muted },
                ]}
            />
            <View style={styles.fill}>
                <ThemedText type="default" numberOfLines={1} style={styles.destinationName}>
                    {category ? category.name : "Category"}
                </ThemedText>
                <ThemedText type="caption" numberOfLines={1} style={styles.pillCaption}>
                    {tutorialWorkspaceLabel ?? (category?.workspace || "Category")}
                </ThemedText>
            </View>
        </View>
    ) : picking ? (
        <View style={[destinationSurface, { borderColor: STAGE.faint }]}>
            <MagnifyingGlass size={16} color={STAGE.muted} />
            <TextInput
                ref={searchRef}
                autoFocus
                value={pickQuery}
                onChangeText={setPickQuery}
                placeholder="Search categories"
                placeholderTextColor={STAGE.muted}
                keyboardAppearance={scheme}
                selectionColor={ThemedColor.primary}
                returnKeyType="done"
                onSubmitEditing={() => {
                    const top = rankCategories(options, pickQuery, {
                        suggestedId: guess?.id,
                        workspace: homeWorkspace,
                    })[0];
                    if (pickQuery.trim() && top) pickCategory(top);
                    stopPicking();
                }}
                style={styles.search}
            />
            <TouchableOpacity onPress={stopPicking} hitSlop={8} accessibilityRole="button">
                <ThemedText type="defaultSemiBold" style={{ color: STAGE.text }}>
                    Done
                </ThemedText>
            </TouchableOpacity>
        </View>
    ) : (
        <TouchableOpacity
            style={destinationSurface}
            activeOpacity={0.7}
            onPress={startPicking}
            accessibilityRole="button"
            accessibilityLabel={
                category
                    ? `Category: ${category.name}. Change`
                    : guess
                      ? `Auto Sort, suggests ${guess.name}. Change`
                      : allowAuto
                        ? "Auto Sort. Pick a category"
                        : "Pick a category"
            }>
            {destination ? (
                <View
                    style={[
                        styles.destinationBar,
                        // The guess shows its color at half strength until chosen
                        { backgroundColor: categoryColor(destination, "dark"), opacity: category ? 1 : 0.5 },
                    ]}
                />
            ) : (
                <Sparkle size={16} color={ThemedColor.primary} weight="fill" />
            )}
            <View style={styles.fill}>
                <ThemedText type="default" numberOfLines={1} style={styles.destinationName}>
                    {destination ? destination.name : allowAuto ? "Auto Sort" : "Pick a category"}
                </ThemedText>
                <ThemedText type="caption" numberOfLines={1} style={styles.pillCaption}>
                    {category
                        ? category.workspace || "Category"
                        : guess
                          ? `Suggested · ${guess.workspace}`
                          : allowAuto
                            ? "Files it for you"
                            : "Required"}
                </ThemedText>
            </View>
            <CaretDown size={14} color={STAGE.muted} weight="bold" />
        </TouchableOpacity>
    );

    // ─── Panels ──────────────────────────────────────────────────────────────
    // Every panel opens in the space above the title, never from the bottom.

    const optionSurface = (selected: boolean) => ({ backgroundColor: selected ? STAGE.selected : STAGE.fill });
    const optionInk = (selected: boolean) => ({ color: selected ? STAGE.onSelected : STAGE.text });

    const chooseSomeday = () => {
        Haptics.selectionAsync();
        dismiss();
        setStartDate(null);
        setStartTime(null);
        setDeadline(null);
        setReminders([]);
        setRecurring(false);
        setFlexDetails(null);
        setSomeday(true);
        closePanel();
    };

    const panelContent = (() => {
        switch (panel) {
            case "start":
            case "due":
                return (
                    <DatePanel
                        target={panel}
                        onTargetChange={(t) => setPanel(t)}
                        onTouched={dismiss}
                        onDone={closePanel}
                        someday={someday}
                        onSomeday={allowSomeday ? chooseSomeday : undefined}
                    />
                );
            case "repeat":
                return <RepeatPanel onDone={closePanel} />;
            case "priority":
                return (
                    <View style={styles.panelBlock}>
                        <SectionTitle title="Priority" style={{ color: STAGE.text }} />
                        <View style={styles.quickRow}>
                            {[1, 2, 3].map((p) => (
                                <TouchableOpacity
                                    key={p}
                                    style={styles.fill}
                                    onPress={() => {
                                        Haptics.selectionAsync();
                                        setPriority(p);
                                        setTouched((t) => ({ ...t, priority: true }));
                                        closePanel();
                                    }}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected: priority === p }}>
                                    <View style={[styles.option, optionSurface(priority === p)]}>
                                        <Flag size={16} color={priorityColor(p)} weight="fill" />
                                        <ThemedText type="lightBody" style={optionInk(priority === p)}>
                                            {PRIORITY_LABEL[p]}
                                        </ThemedText>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                );
            case "difficulty":
                return (
                    <View style={styles.panelBlock}>
                        <SectionTitle title="Difficulty" style={{ color: STAGE.text }} />
                        <View style={styles.levels}>
                            {LEVELS.map((level) => {
                                const selected = touched.value && value === level;
                                return (
                                    <TouchableOpacity
                                        key={level}
                                        onPress={() => {
                                            Haptics.selectionAsync();
                                            setValue(level);
                                            setTouched((t) => ({ ...t, value: true }));
                                            closePanel();
                                        }}
                                        accessibilityRole="button"
                                        accessibilityLabel={`Level ${level}`}
                                        accessibilityState={{ selected }}>
                                        <View style={[styles.level, optionSurface(selected)]}>
                                            <ThemedText type="lightBody" style={optionInk(selected)}>
                                                {level}
                                            </ThemedText>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                );
            case "reminder":
                return <ReminderPanel onDone={closePanel} />;
            case "tag":
                return <TagPanel onDone={closePanel} />;
            case "integration":
                return <IntegrationPanel onDone={closePanel} />;
            default:
                return null;
        }
    })();

    // ─── Tutorial cursor ─────────────────────────────────────────────────────

    // Points at Add once the typed-in title stops changing, with a gentle pulse
    const [showCursor, setShowCursor] = useState(false);
    const cursorPulse = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        if (!tutorial || !mounted || !hasTitle) {
            setShowCursor(false);
            return;
        }
        const t = setTimeout(() => setShowCursor(true), TUTORIAL_TITLE_SETTLE_MS);
        return () => clearTimeout(t);
    }, [tutorial, mounted, hasTitle, taskName]);
    useEffect(() => {
        if (!showCursor) return;
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(cursorPulse, { toValue: 0.84, duration: 700, useNativeDriver: true }),
                Animated.timing(cursorPulse, { toValue: 1, duration: 800, useNativeDriver: true }),
            ])
        );
        pulse.start();
        return () => {
            pulse.stop();
            cursorPulse.setValue(1);
        };
    }, [showCursor, cursorPulse]);

    const stackStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ translateY: (1 - opacity.value) * 16 }],
    }));

    if (!mounted) return null;

    const bottomGap = keyboardUp ? 12 : insets.bottom + 16;
    // What the space above the title holds right now; its key drives the soft fade
    const topBusy = picking || !!token || listening;
    // The tutorial skips the one-question prompts: nothing competes with Add
    const topKey = topBusy ? null : (panel ?? (tutorial ? null : "quickset"));

    const rail = token?.char === "@" ? friendRail : chips;

    const addButton = (
        <PrimaryButton
            title={edit ? "Save" : "Add"}
            onPress={submit}
            disabled={!hasTitle}
            style={{
                ...styles.confirm,
                shadowColor: ThemedColor.primary,
                opacity: hasTitle ? 1 : 0.4,
            }}
        />
    );

    return (
        <Modal
            visible
            transparent
            animationType="none"
            statusBarTranslucent
            onRequestClose={onRequestClose}
            // Focus once presented; autoFocus fires before the modal is on screen
            onShow={() => {
                if (!panelRef.current) focusTitle();
            }}>
            <CaptureBackdrop opacity={opacity} />

            <Pressable
                style={StyleSheet.absoluteFill}
                onPress={() => (picking ? stopPicking() : panel ? closePanel() : close())}
                accessibilityLabel="Close"
            />

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.fill}
                pointerEvents="box-none">
                <Reanimated.View style={[styles.fill, stackStyle]} pointerEvents="box-none">
                    {/* Always-visible way out; the empty scrim below also closes */}
                    <View style={[styles.topBar, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
                        <TouchableOpacity
                            onPress={close}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel={edit ? "Close without saving" : "Close without adding"}
                            style={[styles.closeButton, { backgroundColor: STAGE.fillRaised }]}>
                            <X size={18} color={STAGE.text} weight="bold" />
                        </TouchableOpacity>
                    </View>
                    {/* The space above the title: a panel when one is open, else one question
                        at a time. Swaps fade in quietly; nothing slides or pops. */}
                    <View style={styles.fill} pointerEvents="box-none">
                        {topKey !== null && (
                            <ScrollView
                                style={styles.top}
                                contentContainerStyle={styles.topContent}
                                keyboardShouldPersistTaps="always"
                                showsVerticalScrollIndicator={false}>
                                <Reanimated.View key={topKey} entering={SOFT_ENTER}>
                                    {panel ? (
                                        panelContent
                                    ) : (
                                        <QuickSet
                                            hasTitle={hasTitle}
                                            suggestedPriority={suggestedPriority}
                                            onPriority={(p) => {
                                                setPriority(p);
                                                setTouched((t) => ({ ...t, priority: true }));
                                            }}
                                            onScheduleTouched={dismiss}
                                        />
                                    )}
                                </Reanimated.View>
                            </ScrollView>
                        )}
                    </View>
                    <View style={[styles.stack, { paddingBottom: bottomGap }]} pointerEvents="box-none">
                        {/* Who sees it, stated before the task itself */}
                        <TouchableOpacity
                            onPress={() => {
                                Haptics.selectionAsync();
                                setIsPublic(!isPublic);
                            }}
                            hitSlop={8}
                            style={styles.visibility}
                            accessibilityRole="button"
                            accessibilityLabel={
                                isPublic ? "Public, tap to make private" : "Private, tap to make public"
                            }>
                            {isPublic ? (
                                <Eye size={14} color={ON_DARK_MUTED} />
                            ) : (
                                <EyeSlash size={14} color={ON_DARK_MUTED} />
                            )}
                            <ThemedText type="caption" style={styles.onScrimCaption}>
                                {isPublic ? "Public · friends can see this" : "Private · only you"}
                            </ThemedText>
                            <CaretDown size={10} color={ON_DARK_MUTED} weight="bold" />
                        </TouchableOpacity>

                        <Reanimated.View layout={ROW_TRANSITION} pointerEvents={tutorial ? "none" : undefined}>
                            <TextInput
                                ref={inputRef}
                                multiline
                                submitBehavior="submit"
                                value={taskName}
                                onChangeText={onChangeText}
                                onSelectionChange={onSelectionChange}
                                onSubmitEditing={submit}
                                onFocus={() => {
                                    if (panelRef.current) setPanel(null);
                                    if (pickingRef.current) setPicking(false);
                                }}
                                editable={!listening && !tutorial}
                                placeholder={listening ? "Listening..." : "Add a task"}
                                placeholderTextColor={ON_DARK_MUTED}
                                returnKeyType="done"
                                keyboardAppearance={scheme}
                                selectionColor={ThemedColor.primary}
                                style={[styles.input, picking && { opacity: 0.5 }]}
                            />
                        </Reanimated.View>

                        {picking ? (
                            <CategoryPicker
                                options={options}
                                query={pickQuery}
                                suggestedId={guess?.id}
                                selectedId={category?.id}
                                workspace={homeWorkspace}
                                showAuto={allowAuto}
                                onPickAuto={() => {
                                    pickCategory(null);
                                    stopPicking();
                                }}
                                onPick={(o) => {
                                    pickCategory(o);
                                    stopPicking();
                                }}
                                onCreate={async (name) => {
                                    stopPicking();
                                    const created = await createCategory(name);
                                    if (created) pickCategory(created);
                                }}
                            />
                        ) : (
                            <Reanimated.View layout={ROW_TRANSITION}>{rail}</Reanimated.View>
                        )}

                        <Reanimated.View layout={ROW_TRANSITION} style={styles.bar}>
                            {listening ? (
                                <VoiceWaveform level={volume} active={listening} style={styles.waveform} />
                            ) : (
                                destinationRow
                            )}
                            {!picking && (
                                <>
                                    {!tutorial && (
                                        <TouchableOpacity
                                            onPress={toggleMic}
                                            hitSlop={8}
                                            accessibilityLabel={listening ? "Stop listening" : "Add by voice"}
                                            style={[
                                                styles.iconButton,
                                                { backgroundColor: STAGE.fillRaised },
                                                listening && { backgroundColor: STAGE.selected },
                                            ]}>
                                            {listening ? (
                                                <Stop size={16} color={STAGE.onSelected} weight="fill" />
                                            ) : (
                                                <Microphone size={18} color={STAGE.text} weight="bold" />
                                            )}
                                        </TouchableOpacity>
                                    )}
                                    {tutorial ? (
                                        <View>
                                            {addButton}
                                            {showCursor && (
                                                // Sits under Add, tip up at it; never takes a touch
                                                <View pointerEvents="none" style={styles.tutorialCursor}>
                                                    <TutorialCursor
                                                        size={28}
                                                        label="Tap add"
                                                        bubbleLeft
                                                        arrowScale={cursorPulse}
                                                        labelStartDelay={200}
                                                    />
                                                </View>
                                            )}
                                        </View>
                                    ) : (
                                        addButton
                                    )}
                                </>
                            )}
                        </Reanimated.View>
                    </View>
                </Reanimated.View>
            </KeyboardAvoidingView>
            <CustomAlert
                visible={alert !== null}
                setVisible={(v) => {
                    if (!v) setAlert(null);
                }}
                title={alert?.title ?? ""}
                message={alert?.message}
                buttons={alert?.buttons}
            />
        </Modal>
    );
}

const makeStyles = (C: ReturnType<typeof useThemeColor>) =>
    StyleSheet.create({
        fill: { flex: 1 },
        // Shrinks before the rows below it do, and scrolls if it has to
        top: { flexGrow: 0, flexShrink: 1 },
        // Same inset as the rows below, so panels line up edge to edge with them
        topContent: { paddingHorizontal: 16, paddingTop: 24 },
        stack: { paddingHorizontal: 16, gap: 12 },
        // No card: the title sits straight on the gradient, like a heading being written
        // Drawn straight on the scrim, which is black in both themes
        input: {
            color: ON_DARK,
            fontSize: 24,
            fontWeight: 600,
            fontFamily: "Fraunces",
            letterSpacing: -1,
            minHeight: 32,
            maxHeight: 160,
            paddingHorizontal: 4,
            paddingVertical: 0,
            textAlignVertical: "top",
        },
        rail: { gap: 8, alignItems: "center", paddingHorizontal: 4, minHeight: 36 },
        // Flat fill, 12 radius; a border only marks the default pick
        pill: {
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            height: 40,
            paddingHorizontal: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "transparent",
        },
        pillBar: { width: 4, height: 16 },
        pillText: { color: STAGE.text },
        pillCaption: { color: STAGE.muted },
        hint: { color: ON_DARK_MUTED, paddingHorizontal: 4 },
        onScrimCaption: { color: ON_DARK_MUTED },
        topBar: { flexDirection: "row", paddingHorizontal: 16 },
        // Round icon buttons, as on Luma and Apple Fitness overlays
        closeButton: {
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
        },
        visibility: {
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            alignSelf: "flex-start",
            paddingHorizontal: 4,
        },
        divider: { width: 1, height: 20, marginHorizontal: 4 },
        avatar: { width: 20, height: 20, borderRadius: 20 },
        bar: { flexDirection: "row", alignItems: "center", gap: 8 },
        destination: {
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            minHeight: 48,
            paddingHorizontal: 12,
            paddingVertical: 4,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "transparent",
            flex: 1,
        },
        // Square-cornered and inset, like the planner rows' category bar
        destinationBar: { width: 4, alignSelf: "stretch", marginVertical: 4 },
        destinationName: { color: STAGE.text, lineHeight: 20 },
        search: { flex: 1, color: STAGE.text, fontSize: 16, fontFamily: "Outfit", paddingVertical: 12 },
        waveform: { flex: 1, justifyContent: "flex-start" },
        iconButton: {
            width: 48,
            height: 48,
            borderRadius: 24,
            alignItems: "center",
            justifyContent: "center",
        },
        // PrimaryButton, sized to its label, with the hero-action glow
        confirm: {
            width: "auto",
            alignSelf: "center",
            paddingVertical: 12,
            paddingHorizontal: 20,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.3,
            shadowRadius: 10,
            elevation: 6,
        },
        quickRow: { flexDirection: "row", gap: 8 },
        option: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            height: 44,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "transparent",
            overflow: "hidden",
        },
        dot: { width: 8, height: 8, borderRadius: 8 },
        levels: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
        level: {
            width: 44,
            height: 44,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: "transparent",
            overflow: "hidden",
        },
        panelBlock: { gap: 12 },
        // Just below Add's right edge, arrow tip up at the label
        tutorialCursor: { position: "absolute", top: 28, right: -4, zIndex: 10 },
    });

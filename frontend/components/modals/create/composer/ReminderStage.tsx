import React, { useRef } from "react";
import { updateTaskRemindersAPI } from "@/api/task";
import { useTaskCreation } from "@/contexts/taskCreationContext";
import type { Reminder } from "@/hooks/useReminder";
import { showToast } from "@/utils/showToast";
import PropertyStage from "./PropertyStage";
import ReminderPanel from "./ReminderPanel";

type Props = {
    visible: boolean;
    setVisible: (visible: boolean) => void;
    task: any;
    taskId?: string;
    categoryId?: string;
    onReminderUpdate?: (reminders: Reminder[]) => void;
};

const ReminderEditor = ({ close, taskId, categoryId, onReminderUpdate }: Omit<Props, "visible" | "setVisible" | "task"> & { close: () => void }) => {
    const { reminders } = useTaskCreation();
    const savingRef = useRef(false);

    const save = async () => {
        if (savingRef.current) return;
        savingRef.current = true;
        if (taskId && categoryId) {
            try {
                await updateTaskRemindersAPI(categoryId, taskId, reminders);
            } catch (error) {
                console.error("Failed to update reminders:", error);
                showToast("Failed to update reminders", "danger");
                savingRef.current = false;
                return;
            }
        }
        onReminderUpdate?.(reminders);
        close();
    };

    return <ReminderPanel onDone={save} />;
};

/** Edits an existing task's reminders on the stage, saved together on Done. */
const ReminderStage = ({ visible, setVisible, task, ...rest }: Props) => (
    <PropertyStage visible={visible} setVisible={setVisible} task={task}>
        {(close) => <ReminderEditor close={close} {...rest} />}
    </PropertyStage>
);

export default ReminderStage;

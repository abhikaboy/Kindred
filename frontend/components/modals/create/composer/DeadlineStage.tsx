import React, { useRef } from "react";
import { updateTaskDeadlineAPI } from "@/api/task";
import { useTaskCreation } from "@/contexts/taskCreationContext";
import { showToast } from "@/utils/showToast";
import PropertyStage from "./PropertyStage";
import DatePanel from "./DatePanel";

type Props = {
    visible: boolean;
    setVisible: (visible: boolean) => void;
    task: any;
    taskId?: string;
    categoryId?: string;
    onDeadlineUpdate?: (deadline: Date | null) => void;
};

const DeadlineEditor = ({ close, taskId, categoryId, onDeadlineUpdate }: Omit<Props, "visible" | "setVisible" | "task"> & { close: () => void }) => {
    const { deadline } = useTaskCreation();
    const savingRef = useRef(false);

    const save = async () => {
        if (savingRef.current) return;
        savingRef.current = true;
        if (taskId && categoryId) {
            try {
                await updateTaskDeadlineAPI(categoryId, taskId, deadline);
            } catch (error) {
                console.error("Failed to update deadline:", error);
                showToast("Failed to update deadline", "danger");
                savingRef.current = false;
                return;
            }
        }
        onDeadlineUpdate?.(deadline);
        close();
    };

    return <DatePanel target="due" lockTarget onTargetChange={() => {}} onTouched={() => {}} onDone={save} />;
};

/** Edits an existing task's due date on the stage; Clear then Done removes it. */
const DeadlineStage = ({ visible, setVisible, task, ...rest }: Props) => (
    <PropertyStage visible={visible} setVisible={setVisible} task={task}>
        {(close) => <DeadlineEditor close={close} {...rest} />}
    </PropertyStage>
);

export default DeadlineStage;

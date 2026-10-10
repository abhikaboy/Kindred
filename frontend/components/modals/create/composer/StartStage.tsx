import React, { useEffect, useRef, useState } from "react";
import * as Haptics from "expo-haptics";
import { updateTaskStartAPI } from "@/api/task";
import { clearTaskSomedayAPI, setTaskSomedayAPI } from "@/api/plan";
import { isSomedayTask } from "@/hooks/useSomedayTasks";
import { useTaskCreation } from "@/contexts/taskCreationContext";
import { combineDateAndTime } from "@/utils/timeUtils";
import { showToast } from "@/utils/showToast";
import PropertyStage from "./PropertyStage";
import DatePanel from "./DatePanel";

type Props = {
    visible: boolean;
    setVisible: (visible: boolean) => void;
    task: any;
    taskId?: string;
    categoryId?: string;
    onStartUpdate?: (startDate: Date | null, startTime: Date | null, someday: boolean) => void;
};

const StartEditor = ({ close, task, taskId, categoryId, onStartUpdate }: Omit<Props, "visible" | "setVisible"> & { close: () => void }) => {
    const { startDate, startTime, setStartDate, setStartTime } = useTaskCreation();
    const wasSomeday = isSomedayTask(task);
    const [someday, setSomeday] = useState(wasSomeday);
    // Picking a day replaces Someday
    useEffect(() => {
        if (startDate) setSomeday(false);
    }, [startDate]);
    const savingRef = useRef(false);

    const save = async () => {
        if (savingRef.current) return;
        savingRef.current = true;
        if (taskId && categoryId) {
            try {
                if (someday) {
                    if (!wasSomeday) await setTaskSomedayAPI(categoryId, taskId);
                } else {
                    if (wasSomeday) await clearTaskSomedayAPI(categoryId, taskId);
                    await updateTaskStartAPI(categoryId, taskId, startDate, startTime);
                }
            } catch (error) {
                console.error("Failed to update start:", error);
                showToast("Failed to update start date", "danger");
                savingRef.current = false;
                return;
            }
        }
        onStartUpdate?.(someday ? null : startDate, someday ? null : startTime, someday);
        close();
    };

    // The server rejects Someday on repeating tasks
    const allowSomeday = !task?.recurring && !task?.templateID;
    return (
        <DatePanel
            target="start"
            lockTarget
            onTargetChange={() => {}}
            onTouched={() => {}}
            onDone={save}
            someday={someday}
            onSomeday={
                allowSomeday
                    ? () => {
                          Haptics.selectionAsync();
                          setStartDate(null);
                          setStartTime(null);
                          setSomeday(true);
                      }
                    : undefined
            }
        />
    );
};

/** Edits an existing task's start date/time on the stage. */
const StartStage = ({ visible, setVisible, task, ...rest }: Props) => (
    <PropertyStage visible={visible} setVisible={setVisible} task={task}>
        {(close) => <StartEditor close={close} task={task} {...rest} />}
    </PropertyStage>
);

export default StartStage;

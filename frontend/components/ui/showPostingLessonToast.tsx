import React from "react";
import { hideToastable, showToastable } from "react-native-toastable";
import TaskToast from "@/components/ui/TaskToast";
import type { LessonTask } from "@/contexts/PostingLessonContext";

// How long the posting lesson's toast stays up while the screen is blurred behind it
export const LESSON_TOAST_MS = 60000;

/** The long-lived completion toast the posting lesson blurs the screen around. */
export function showPostingLessonToast(opts: {
    title: string;
    taskData: LessonTask;
    /** The toast was tapped: the lesson moves on to the camera. */
    onTap: () => void;
    /** The toast went away (swiped or timed out). */
    onGone: () => void;
}) {
    showToastable({
        title: opts.title,
        status: "success",
        position: "top",
        swipeDirection: "up",
        duration: LESSON_TOAST_MS,
        message: "Tap here to share it with your friends!",
        onToastableHide: opts.onGone,
        renderContent: (props) => (
            <TaskToast
                {...props}
                taskData={opts.taskData}
                onBeforeNavigate={() => {
                    opts.onTap();
                    hideToastable();
                }}
            />
        ),
    });
}

import React from "react";
import { showToastable } from "react-native-toastable";
import DefaultToast from "@/components/ui/DefaultToast";

const STATUS_TITLES = {
    success: "Success",
    danger: "Error",
    warning: "Warning",
    info: "Info",
} as const;

export function showToast(
    message: string,
    status: "success" | "danger" | "warning" | "info",
    title?: string
) {
    showToastable({
        title: title || STATUS_TITLES[status],
        message,
        status,
        duration: 2500,
        swipeDirection: "up",
        renderContent: (props) => <DefaultToast {...props} />,
    });
}

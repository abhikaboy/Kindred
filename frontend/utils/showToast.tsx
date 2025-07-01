import React from "react";
import { showToastable } from "react-native-toastable";
import DefaultToast from "@/components/ui/DefaultToast";

export function showToast(message: string, status: "success" | "danger" | "warning" | "info") {
    showToastable({
        title: "Default Title!",
        message,
        status,
        duration: 2500,
        swipeDirection: "up",
        renderContent: (props) => <DefaultToast {...props} />,
    });
}

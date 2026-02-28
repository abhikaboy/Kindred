import { useCallback, useRef, useState } from "react";
import { intentTaskNaturalLanguageAPI, confirmTasksFromNaturalLanguageAPI, bulkDeleteTasksAPI } from "@/api/task";
import type { IntentOp } from "@/api/task";
import type { components } from "@/api/generated/types";

type PreviewPayload = components["schemas"]["ConfirmTaskNaturalLanguageInputBody"];
type TaskDocument = components["schemas"]["TaskDocument"];

type UseIntentRouterFlowOptions = {
    onComplete?: () => void;
};

type UseIntentRouterFlowReturn = {
    isPreviewing: boolean;
    isConfirming: boolean;
    isDeletingTasks: boolean;
    previewPayload: PreviewPayload | null;
    editResult: IntentOp["editResult"] | null;
    deletePreviewTasks: TaskDocument[];
    errorTitle: string;
    errorDetails: string[];
    pendingOpsCount: number;
    currentOpIndex: number;
    processText: (text: string, timezone?: string) => Promise<void>;
    confirmCreate: () => Promise<void>;
    dismissEditResult: () => void;
    confirmDelete: (selectedIds: string[]) => Promise<void>;
    dismissDelete: () => void;
    reset: () => void;
    setError: (title: string, details?: string[]) => void;
    clearError: () => void;
};

export function useIntentRouterFlow(options: UseIntentRouterFlowOptions = {}): UseIntentRouterFlowReturn {
    const { onComplete } = options;

    const [isPreviewing, setIsPreviewing] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);
    const [isDeletingTasks, setIsDeletingTasks] = useState(false);
    const [previewPayload, setPreviewPayload] = useState<PreviewPayload | null>(null);
    const [editResult, setEditResult] = useState<IntentOp["editResult"] | null>(null);
    const [deletePreviewTasks, setDeletePreviewTasks] = useState<TaskDocument[]>([]);
    const [errorTitle, setErrorTitle] = useState("");
    const [errorDetails, setErrorDetails] = useState<string[]>([]);
    const [pendingOps, setPendingOps] = useState<IntentOp[]>([]);
    // Ref for use inside callbacks (avoids stale closures); state for render-time consumption.
    const [currentOpIndex, setCurrentOpIndex] = useState(0);
    const currentOpIndexRef = useRef(0);

    const clearError = useCallback(() => {
        setErrorTitle("");
        setErrorDetails([]);
    }, []);

    const setError = useCallback((title: string, details: string[] = []) => {
        setErrorTitle(title);
        setErrorDetails(details);
    }, []);

    const setErrorFromModel = useCallback(
        (error: unknown, fallbackTitle: string, fallbackDetail: string) => {
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
        },
        []
    );

    const completeFlow = useCallback(() => {
        if (onComplete) onComplete();
    }, [onComplete]);

    const advanceToNextOp = useCallback(
        (ops: IntentOp[], nextIndex: number) => {
            currentOpIndexRef.current = nextIndex;
            setCurrentOpIndex(nextIndex);
            if (nextIndex >= ops.length) {
                completeFlow();
                return;
            }
            const op = ops[nextIndex];
            if (op.type === "create" && op.createPreview) {
                setPreviewPayload(op.createPreview as PreviewPayload);
            } else if (op.type === "delete" && op.deleteTasks && op.deleteTasks.length > 0) {
                setDeletePreviewTasks(op.deleteTasks);
            } else if (op.type === "edit" && op.editResult) {
                setEditResult(op.editResult);
            } else {
                advanceToNextOp(ops, nextIndex + 1);
            }
        },
        [completeFlow]
    );

    const processText = useCallback(
        async (text: string, timezone?: string) => {
            if (!text.trim()) return;
            clearError();
            setIsPreviewing(true);
            try {
                const resolvedTimezone =
                    timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
                const result = await intentTaskNaturalLanguageAPI(text.trim(), resolvedTimezone);
                const ops = result.ops ?? [];
                if (ops.length === 0) {
                    setError("Nothing to do", [
                        "No matching tasks or instructions found. Try rephrasing.",
                    ]);
                    setIsPreviewing(false);
                    return;
                }
                setPendingOps(ops);
                currentOpIndexRef.current = 0;
                advanceToNextOp(ops, 0);
            } catch (error) {
                setErrorFromModel(error, "Couldn't Process Request", "Please try again.");
            } finally {
                setIsPreviewing(false);
            }
        },
        [advanceToNextOp, clearError, setError, setErrorFromModel]
    );

    const confirmCreate = useCallback(async () => {
        if (!previewPayload || isConfirming) return;
        clearError();
        setIsConfirming(true);
        try {
            await confirmTasksFromNaturalLanguageAPI(previewPayload);
            setPreviewPayload(null);
            setIsConfirming(false);
            advanceToNextOp(pendingOps, currentOpIndexRef.current + 1);
        } catch (error) {
            setIsConfirming(false);
            setErrorFromModel(error, "Couldn't Add Tasks", "Please try again.");
        }
    }, [advanceToNextOp, clearError, isConfirming, pendingOps, previewPayload, setErrorFromModel]);

    const dismissEditResult = useCallback(() => {
        setEditResult(null);
        advanceToNextOp(pendingOps, currentOpIndexRef.current + 1);
    }, [advanceToNextOp, pendingOps]);

    const confirmDelete = useCallback(async (selectedIds: string[]) => {
        const toDelete = deletePreviewTasks.filter((t) => selectedIds.includes(t.id));
        if (toDelete.length === 0) {
            setDeletePreviewTasks([]);
            advanceToNextOp(pendingOps, currentOpIndexRef.current + 1);
            return;
        }
        setIsDeletingTasks(true);
        try {
            await bulkDeleteTasksAPI(
                toDelete.map((t) => ({
                    taskId: t.id,
                    categoryId: t.categoryID || "",
                    deleteRecurring: false,
                }))
            );
            setDeletePreviewTasks([]);
            advanceToNextOp(pendingOps, currentOpIndexRef.current + 1);
        } catch (error) {
            setErrorFromModel(error, "Couldn't Delete Tasks", "Please try again.");
        } finally {
            setIsDeletingTasks(false);
        }
    }, [advanceToNextOp, deletePreviewTasks, pendingOps, setErrorFromModel]);

    const dismissDelete = useCallback(() => {
        setDeletePreviewTasks([]);
        advanceToNextOp(pendingOps, currentOpIndexRef.current + 1);
    }, [advanceToNextOp, pendingOps]);

    const reset = useCallback(() => {
        setPendingOps([]);
        currentOpIndexRef.current = 0;
        setCurrentOpIndex(0);
        setPreviewPayload(null);
        setEditResult(null);
        setDeletePreviewTasks([]);
        setIsPreviewing(false);
        setIsConfirming(false);
        setIsDeletingTasks(false);
        clearError();
    }, [clearError]);

    return {
        isPreviewing,
        isConfirming,
        isDeletingTasks,
        previewPayload,
        editResult,
        deletePreviewTasks,
        errorTitle,
        errorDetails,
        pendingOpsCount: pendingOps.length,
        currentOpIndex,
        processText,
        confirmCreate,
        dismissEditResult,
        confirmDelete,
        dismissDelete,
        reset,
        setError,
        clearError,
    };
}

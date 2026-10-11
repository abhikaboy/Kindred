import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { router, usePathname } from "expo-router";
import { useAuth } from "@/hooks/useAuth";
import { useOnboardingV2Context } from "@/contexts/OnboardingV2Context";
import { isOnboardingV2Active } from "@/utils/onboardingV2/active";
import {
    FRESH_LESSON_STATE,
    afterOffer,
    completeLesson,
    isPostingStep,
    shouldOfferLesson,
    type LessonState,
    type LessonStep,
} from "@/utils/postingLesson/machine";
import { loadLessonState, saveLessonState } from "@/utils/postingLesson/storage";
import { consumeForcedPostingLesson } from "@/utils/postingLesson/devForce";
import { subscribePostingLessonDemo } from "@/utils/postingLesson/demo";
import { showPostingLessonToast } from "@/components/ui/showPostingLessonToast";

const STEP_INDEX: Record<LessonStep, number> = { toast: 0, camera: 1, caption: 2, post: 3 };

export type LessonTask = {
    id: string;
    name: string;
    category: string;
    categoryName: string;
    points?: number;
    public?: boolean;
};

type PostingLessonContextType = {
    /** The lesson's current step, or null when it isn't running. */
    step: LessonStep | null;
    /** Called after a completion. Returns true when this completion starts the lesson (show its toast). */
    tryStart: (tasksComplete: number, task: LessonTask) => boolean;
    /** Moves forward only; going back or sideways is ignored. */
    advance: (to: LessonStep) => void;
    /** The user dismissed it or walked away. */
    skip: () => void;
    /** The user posted (or hit the end of the lesson). It won't be offered again. */
    finish: () => void;
    /** The lesson toast went away on its own or was swiped. */
    toastGone: () => void;
};

const DETACHED: PostingLessonContextType = {
    step: null,
    tryStart: () => false,
    advance: () => {},
    skip: () => {},
    finish: () => {},
    toastGone: () => {},
};

const PostingLessonContext = createContext<PostingLessonContextType | undefined>(undefined);

/** Mount below the onboarding provider: the lesson stays out of the way of the first-run coach. */
export function PostingLessonProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const userId = user?._id ?? null;
    const { step: coachStep, isLoading: coachLoading, dispatch: dispatchCoach } = useOnboardingV2Context();
    const pathname = usePathname();

    const [step, setStepState] = useState<LessonStep | null>(null);
    const stepRef = useRef<LessonStep | null>(null);
    const lessonState = useRef<LessonState | null>(null);
    const seenPostingScreen = useRef(false);

    const setStep = useCallback((next: LessonStep | null) => {
        stepRef.current = next;
        if (next === null) seenPostingScreen.current = false;
        setStepState(next);
    }, []);

    // Read this user's saved state once; tryStart refuses until it has loaded.
    useEffect(() => {
        lessonState.current = null;
        setStep(null);
        if (!userId) return;
        let cancelled = false;
        loadLessonState(userId).then((loaded) => {
            if (!cancelled) lessonState.current = loaded;
        });
        return () => {
            cancelled = true;
        };
    }, [userId, setStep]);

    const persist = useCallback(
        (next: LessonState) => {
            lessonState.current = next;
            if (userId) saveLessonState(userId, next).catch(() => {});
        },
        [userId]
    );

    const coachBusyRef = useRef(false);
    coachBusyRef.current = isOnboardingV2Active(coachStep, coachLoading);
    const postsMadeRef = useRef<number | undefined>(undefined);
    postsMadeRef.current = (user as { posts_made?: number } | null)?.posts_made;

    const tryStart = useCallback(
        (tasksComplete: number, _task: LessonTask) => {
            const state = lessonState.current;
            if (!userId || !state || stepRef.current !== null) return false;
            const offer =
                consumeForcedPostingLesson() ||
                shouldOfferLesson({
                    tasksComplete,
                    postsMade: postsMadeRef.current,
                    state,
                    coachBusy: coachBusyRef.current,
                });
            if (!offer) return false;
            persist(afterOffer(state));
            setStep("toast");
            return true;
        },
        [userId, persist, setStep]
    );

    const advance = useCallback(
        (to: LessonStep) => {
            const current = stepRef.current;
            if (current === null || STEP_INDEX[to] <= STEP_INDEX[current]) return;
            setStep(to);
        },
        [setStep]
    );

    const skip = useCallback(() => setStep(null), [setStep]);

    const finish = useCallback(() => {
        if (stepRef.current === null) return;
        persist(completeLesson(lessonState.current ?? FRESH_LESSON_STATE));
        setStep(null);
    }, [persist, setStep]);

    const toastGone = useCallback(() => {
        if (stepRef.current === "toast") setStep(null);
    }, [setStep]);

    // Dev only: kindred:///dev-onboarding?demo=<step> starts the lesson at any step
    useEffect(() => {
        if (!__DEV__) return;
        return subscribePostingLessonDemo((demoStep) => {
            // The first-run coach would sit on top of the demo
            dispatchCoach({ type: "SKIP" });
            setStep(demoStep);
            if (demoStep === "toast") {
                showPostingLessonToast({
                    title: "Task completed!",
                    taskData: { id: "demo", name: "Demo task", category: "demo", categoryName: "Demo" },
                    onTap: () => advance("camera"),
                    onGone: toastGone,
                });
            }
            // Same short paths the real toast and camera use
            if (demoStep === "camera") router.push("/posting/cameraview");
            if (demoStep === "caption" || demoStep === "post") router.push("/posting/caption");
        });
    }, [setStep, advance, toastGone, dispatchCoach]);

    // Leaving the posting screens ends the lesson. Ignored until one has been seen, because the route
    // is pushed a moment after the step advances.
    useEffect(() => {
        if (!isPostingStep(step)) return;
        if (pathname.startsWith("/posting")) seenPostingScreen.current = true;
        else if (seenPostingScreen.current) setStep(null);
    }, [pathname, step, setStep]);

    const value = useMemo(
        () => ({ step, tryStart, advance, skip, finish, toastGone }),
        [step, tryStart, advance, skip, finish, toastGone]
    );
    return <PostingLessonContext.Provider value={value}>{children}</PostingLessonContext.Provider>;
}

export function usePostingLesson(): PostingLessonContextType {
    return useContext(PostingLessonContext) ?? DETACHED;
}

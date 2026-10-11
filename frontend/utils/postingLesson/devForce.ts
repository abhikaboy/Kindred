// Dev only: lets the dev-onboarding screen show the posting lesson on the next completion without
// needing the user's lifetime total to be exactly 3.
let forced = false;

export const forcePostingLessonOnNextCompletion = (value: boolean) => {
    forced = __DEV__ && value;
};

/** True once, then clears itself. */
export const consumeForcedPostingLesson = (): boolean => {
    const was = forced;
    forced = false;
    return was;
};

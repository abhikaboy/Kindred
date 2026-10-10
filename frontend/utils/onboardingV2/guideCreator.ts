// Lets the real "+" in the Workspaces header create the Kindred Guide while onboarding step 1 is showing.
let handler: (() => void) | null = null;

/** The host registers while step 1 is visible. Returns a cleanup that only clears its own handler. */
export function registerGuideCreator(fn: () => void): () => void {
    handler = fn;
    return () => {
        if (handler === fn) handler = null;
    };
}

/** True when the tap was consumed by the guide creator; false means open the normal create sheet. */
export function tryCreateGuide(): boolean {
    if (!handler) return false;
    handler();
    return true;
}

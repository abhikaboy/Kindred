export const PHASE_COUNT = 5;

const STEP_TO_PHASE: readonly (number | null)[] = [0, 0, 1, 2, 3, 3, 4, null, null];

/** Maps an onboarding step (0..8) to a progress-dot phase; null hides the dots. */
export function phaseDots(step: number): { index: number; total: number } | null {
    if (!Number.isInteger(step) || step < 0 || step >= STEP_TO_PHASE.length) return null;
    const index = STEP_TO_PHASE[step];
    return index === null ? null : { index, total: PHASE_COUNT };
}

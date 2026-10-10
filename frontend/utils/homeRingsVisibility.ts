// Whether Home's concentric rings are on screen. When they are, ring progress shows on the rings
// themselves and the full-screen ring-update overlay stays out of the way.
let onHomePage = false;
let scrolledPastRings = false;

export const setHomePageActive = (active: boolean) => {
    onHomePage = active;
};

export const setHomeScrolledPastRings = (past: boolean) => {
    scrolledPastRings = past;
};

export const areHomeRingsVisible = () => onHomePage && !scrolledPastRings;

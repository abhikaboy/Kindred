type Listener = (active: boolean) => void;

const listeners = new Set<Listener>();

// Lets the home guided tour tell the tabs layout to hide the tab bar + FAB
// while it's running (they render above the tour overlay otherwise).
export const homeTourVisibilityEvents = {
    subscribe(fn: Listener) {
        listeners.add(fn);
        return () => { listeners.delete(fn); };
    },

    emit(active: boolean) {
        listeners.forEach((fn) => fn(active));
    },
};

const homeListeners = new Set<Listener>();
let homeVisible = false;

// Home's focus page docks its own quick add, so the tabs layout hides the FAB there.
export const homePageVisibilityEvents = {
    subscribe(fn: Listener) {
        homeListeners.add(fn);
        fn(homeVisible);
        return () => { homeListeners.delete(fn); };
    },

    emit(visible: boolean) {
        homeVisible = visible;
        homeListeners.forEach((fn) => fn(visible));
    },
};

const homePagerListeners = new Set<Listener>();
let onHomePager = false;

// True only while the pager sits on the Home page itself (not Today, Friends or a workspace). Focus
// mode hides the tab bar there and nowhere else, so every other page can navigate back Home.
export const homePagerActiveEvents = {
    subscribe(fn: Listener) {
        homePagerListeners.add(fn);
        fn(onHomePager);
        return () => { homePagerListeners.delete(fn); };
    },

    emit(active: boolean) {
        onHomePager = active;
        homePagerListeners.forEach((fn) => fn(active));
    },
};

const scheduleListeners = new Set<Listener>();
let scheduling = false;

// While a calendar time range is being scheduled, the pager dots + FAB step aside for its peek.
export const scheduleSelectionEvents = {
    subscribe(fn: Listener) {
        scheduleListeners.add(fn);
        fn(scheduling);
        return () => { scheduleListeners.delete(fn); };
    },

    emit(active: boolean) {
        scheduling = active;
        scheduleListeners.forEach((fn) => fn(active));
    },
};

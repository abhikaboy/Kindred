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

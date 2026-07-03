type Listener = () => void;

const listeners = new Set<Listener>();

// Fired when a push arrives so screens with hand-rolled caches (e.g. the home
// kudos counts in AsyncStorage) can force-refetch immediately.
export const notificationRefreshEvents = {
    subscribe(fn: Listener) {
        listeners.add(fn);
        return () => { listeners.delete(fn); };
    },

    emit() {
        listeners.forEach((fn) => fn());
    },
};

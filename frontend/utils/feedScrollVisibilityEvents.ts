type Listener = (visible: boolean) => void;

const listeners = new Set<Listener>();

export const feedScrollVisibilityEvents = {
    subscribe(fn: Listener) {
        listeners.add(fn);
        return () => { listeners.delete(fn); };
    },

    emit(visible: boolean) {
        listeners.forEach((fn) => fn(visible));
    },
};

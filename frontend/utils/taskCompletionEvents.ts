type CompletionEvent = { taskId: string; newStreak?: number };
type Listener = (event: CompletionEvent) => void;

const listeners = new Set<Listener>();

// Fired by markAsCompletedAPI on success, so side effects that must follow every
// completion path (widgets, Live Activities) live in one subscriber.
export const taskCompletionEvents = {
    subscribe(fn: Listener) {
        listeners.add(fn);
        return () => { listeners.delete(fn); };
    },

    emit(event: CompletionEvent) {
        listeners.forEach((fn) => {
            try { fn(event); } catch { /* a subscriber must not break completion */ }
        });
    },
};

type Listener = (workspaceName: string) => void;

const listeners = new Set<Listener>();

export const workspaceStateEvents = {
    subscribe(fn: Listener) {
        listeners.add(fn);
        return () => { listeners.delete(fn); };
    },

    emit(workspaceName: string) {
        listeners.forEach((fn) => fn(workspaceName));
    },
};

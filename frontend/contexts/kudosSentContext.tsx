import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";

export type KudosKind = "encouragement" | "congratulation";

export interface KudosSent {
    recipientName: string;
    message: string;
    kind: KudosKind;
    /** Task the kudos was about, when task-scoped. */
    taskName?: string;
    /** Preview of the sent image/GIF, or a video's thumbnail. */
    imageUri?: string;
}

interface KudosSentContextValue {
    current: KudosSent | null;
    showKudosSent: (kudos: KudosSent) => void;
    onComplete: () => void;
}

const KudosSentContext = createContext<KudosSentContextValue>({
    current: null,
    showKudosSent: () => {},
    onComplete: () => {},
});

export const useKudosSent = () => useContext(KudosSentContext);

export const KudosSentProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const [current, setCurrent] = useState<KudosSent | null>(null);
    const queueRef = useRef<KudosSent[]>([]);
    const isAnimatingRef = useRef(false);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const startNext = useCallback(() => {
        if (!mountedRef.current) return;
        const next = queueRef.current.shift();
        if (!next) {
            isAnimatingRef.current = false;
            setCurrent(null);
            return;
        }
        isAnimatingRef.current = true;
        setCurrent(next);
    }, []);

    const showKudosSent = useCallback(
        (kudos: KudosSent) => {
            if (!kudos) return;
            queueRef.current.push(kudos);
            if (!isAnimatingRef.current) startNext();
        },
        [startNext]
    );

    const onComplete = useCallback(() => {
        // Tiny gap between consecutive animations so they don't feel mashed together.
        setTimeout(() => {
            if (mountedRef.current) startNext();
        }, 120);
    }, [startNext]);

    const value = React.useMemo(
        () => ({ current, showKudosSent, onComplete }),
        [current, showKudosSent, onComplete]
    );

    return (
        <KudosSentContext.Provider value={value}>
            {children}
        </KudosSentContext.Provider>
    );
};

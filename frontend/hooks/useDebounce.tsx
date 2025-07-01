// Debounce hook that prevents multiple calls to a function within a certain time period
// Used to prevent multiple API calls to the same function
// @param func - The function to debounce
// @param delay - The delay in milliseconds

import React, { useLayoutEffect, useRef } from "react";
import { useMemo } from "react";

// @returns The debounced function
export const useDebounce = (callback: (...args: any[]) => void, delay: number) => {
    const callbackRef = useRef(callback);

    useLayoutEffect(() => {
        callbackRef.current = callback;
    });

    let timer: number;

    const naiveDebounce = (func: (...args: any[]) => void, delayMs: number, ...args: any[]) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            func(...args);
        }, delayMs);
    };

    return useMemo(
        () =>
            (...args: any) =>
                naiveDebounce(callbackRef.current, delay, ...args),
        [delay]
    );
};

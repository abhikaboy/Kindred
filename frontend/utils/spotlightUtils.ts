import { Dimensions, View, ScrollView } from "react-native";
import type React from "react";

export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const isOnScreen = (ref: React.RefObject<View>) =>
    new Promise<boolean>((resolve) => {
        requestAnimationFrame(() => {
            if (!ref.current) return resolve(false);
            ref.current.measureInWindow((_x, y, _w, h) => {
                const screenHeight = Dimensions.get("window").height;
                resolve(y >= 0 && y + h <= screenHeight);
            });
        });
    });

export const ensureVisible = async (
    ref: React.RefObject<View>,
    scrollRef?: React.RefObject<ScrollView>,
    layout?: { y: number; height: number }
) => {
    if (await isOnScreen(ref)) return true;
    if (scrollRef?.current && layout) {
        scrollRef.current.scrollTo({ y: Math.max(layout.y - 20, 0), animated: true });
        await delay(300);
        return isOnScreen(ref);
    }
    return false;
};

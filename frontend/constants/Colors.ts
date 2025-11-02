const tintColorLight = "#0a7ea4";
const tintColorDark = "#fff";

export const Colors = {
    light: {
        text: "#13121F",
        header: "#13121F",
        buttonText: "#FFFFFF",
        background: "#FFFFFF",
        disabled: "#66666633",
        input: "#66666633",
        lightened: "#F5f5f5",
        lightenedCard: "#FAFAFA",
        primary: "#854DFF",
        primaryPressed: "#2D1E52",
        success: "#1CF954",
        error: "#FF5C5F",
        warning: "#FFD700",
        caption: "#919090ff",
        tertiary: "#E5E5E5",

        tint: tintColorDark,
        icon: "#9BA1A6",
        tabIconDefault: "#9BA1A6",
        tabIconSelected: tintColorDark,
        modalTop: "#696969",
        shadowSmall: "0px 1px 5px 0px #0000001a",

        gradient: [
            "rgba(255, 255, 255, 1)",
            "rgba(255, 255, 255, 1)",
            "rgba(255, 255, 255, 0.75)",
            "rgba(255, 255, 255, 0.62)",
            "rgba(255, 255, 255, 0.52)",
            "rgba(255, 255, 255, 0)",
        ],
    },
    dark: {
        text: "#FFFFFF",
        header: "#F9EAFF",
        background: "#13121F",
        disabled: "#66666633",
        buttonText: "#FFFFFF",
        input: "#66666633",
        primary: "#854DFF",
        primaryPressed: "#2D1E52",
        success: "#5CFF95",
        error: "#FF5C5F",
        warning: "#FFFF5C",
        caption: "#919090ff",
        lightened: "#171626",
        lightenedCard: "#1a1929ff",
        tertiary: "#1C1B2A",
        tint: tintColorDark,
        icon: "#9BA1A6",
        tabIconDefault: "#9BA1A6",
        tabIconSelected: tintColorDark,
        modalTop: "#696969",
        shadowSmall: "0px 1px 5px 0px #00000038",

        gradient: [
            "rgba(0, 0, 0, 0.9)",
            "rgba(0, 0, 0, 0.9)",
            "rgba(0, 0, 0, 0.6)",
            "rgba(0, 0, 0, 0.4)",
            "rgba(0, 0, 0, 0.3)",
            "rgba(0, 0, 0, 0)",
        ],
    },
};

let ThemedColor = Colors.dark;

export const initTheme = (mode: keyof typeof Colors) => {
    console.warn("initTheme", mode);
    ThemedColor = Colors[mode];
};

export const getThemedColor = (mode: keyof typeof Colors) => Colors[mode] ?? Colors.light;

export const getGradient = (theme: "light" | "dark") => {
    return Colors[theme].gradient;
};
const tintColorLight = "#0a7ea4";
const tintColorDark = "#fff";

export const Colors = {
    light: {
        text: "#13121F",
        header: "#13121F",
        buttonText: "#fffFFF",
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
    },
    dark: {
        text: "#fffFFF",
        modalTop: "#696969",
        header: "#F9EAFF",
        background: "#13121F",
        disabled: "#66666633",
        buttonText: "#fff",
        input: "#66666633",
        primary: "#854DFF",
        primaryPressed: "#2D1E52",
        success: "#5CFF95",
        error: "#FF5C5F",
        warning: "#FFFF5C",
        caption: "#919090ff",
        lightened: "#171626",
        lightenedCard: "#1d1c2eff",
        tertiary: "#1C1B2A",
        tint: tintColorDark,
        icon: "#9BA1A6",
        tabIconDefault: "#9BA1A6",
        tabIconSelected: tintColorDark,
        shadowSmall: "0px 1px 5px 0px #ffffff0f",
    },
};
let ThemedColor = Colors.dark;

export const initTheme = (mode: string) => {
    console.warn("initTheme", mode);
    ThemedColor = Colors[mode];
};

export const getThemedColor = (color) => Colors[color] ?? Colors["light"];

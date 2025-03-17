const tintColorLight = "#0a7ea4";
const tintColorDark = "#fff";

const Colors = {
    light: {
        text: "#13121F",
        header: "#13121F",
        buttonText: "#fff",
        background: "#FFF",
        disabled: "#66666633",
        input: "#66666633",
        lightened: "#F5f5f5",
        primary: "#854DFF",
        primaryPressed: "#2D1E52",
        success: "#5CFF95",
        error: "#FF5C5F",
        warning: "#FFFF5C",
        caption: "#9D9D9D",

        tint: tintColorDark,
        icon: "#9BA1A6",
        tabIconDefault: "#9BA1A6",
        tabIconSelected: tintColorDark,
        modalTop: "#696969",
    },
    dark: {
        text: "#fff",
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
        caption: "#9D9D9D",
        lightened: "#171626",

        tint: tintColorDark,
        icon: "#9BA1A6",
        tabIconDefault: "#9BA1A6",
        tabIconSelected: tintColorDark,
    },
};
let ThemedColor = Colors.dark;

export const initTheme = (mode: string) => {
    ThemedColor = Colors[mode];
};

export const getThemedColor = () => ThemedColor;
export default getThemedColor();

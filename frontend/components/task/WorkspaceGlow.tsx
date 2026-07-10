import React from "react";
import GlowBackground, { GlowBlob } from "@/components/ui/GlowBackground";

// hand-tuned strengths — verify on OLED before changing
const WORKSPACE_GLOW: GlowBlob[] = [
    { color: "#854DFF", opacity: { dark: 0.08, light: 0.06 }, cx: 30, cy: 25, rx: 38, ry: 19, falloff: "60%" },
    { color: "#4D9EFF", opacity: { dark: 0.06, light: 0.075 }, cx: 85, cy: 80, rx: 33, ry: 16 },
];

// home view: glow lives behind the dashboard cards (mid-lower band), clear of the rings up top
const HOME_GLOW: GlowBlob[] = [
    { color: "#854DFF", opacity: { dark: 0.075, light: 0.06 }, cx: 45, cy: 62, rx: 40, ry: 20, falloff: "60%" },
    { color: "#4D9EFF", opacity: { dark: 0.06, light: 0.075 }, cx: 82, cy: 90, rx: 30, ry: 14 },
];

/** Static two-hue ambient glow behind the task tab. known-app inspired; deliberately faint. */
export default function WorkspaceGlow({ variant = "workspace" }: { variant?: "workspace" | "home" }) {
    return <GlowBackground blobs={variant === "home" ? HOME_GLOW : WORKSPACE_GLOW} />;
}

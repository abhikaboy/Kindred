import React from "react";
import GlowBackground, { GlowBlob } from "@/components/ui/GlowBackground";

// sits below the parallax banner (top ~40% of screen) so it never fights the banner gradient
const PROFILE_GLOW: GlowBlob[] = [
    { color: "#854DFF", opacity: { dark: 0.06, light: 0.03 }, cx: 62, cy: 68, rx: 38, ry: 19, falloff: "60%" },
    { color: "#4D9EFF", opacity: { dark: 0.05, light: 0.06 }, cx: 18, cy: 92, rx: 33, ry: 14 },
];

/** Ambient glow shared by the own-profile and other-profile screens. */
export default function ProfileGlow() {
    return <GlowBackground blobs={PROFILE_GLOW} />;
}

import { useEffect, useState } from "react";
import { SquaresFour, type Icon as PhosphorIcon } from "@phosphor-icons/react";

// Workspace icons are arbitrary Phosphor names, so the whole set is lazy-loaded
// once (its own async chunk) instead of bloating the main bundle. Mirrors mobile.
let iconsPromise: Promise<typeof import("@phosphor-icons/react")> | null = null;
const loadIcons = () => (iconsPromise ??= import("@phosphor-icons/react"));

export function WorkspaceIcon({
  name,
  color,
  size,
}: {
  name?: string;
  color?: string;
  size?: number;
}) {
  const [mod, setMod] = useState<Record<string, PhosphorIcon> | null>(null);
  useEffect(() => {
    let active = true;
    loadIcons().then((m) => active && setMod(m as unknown as Record<string, PhosphorIcon>));
    return () => {
      active = false;
    };
  }, []);
  if (!mod) return <SquaresFour size={size} color={color || undefined} weight="regular" />;
  const Icon = (name && mod[name]) || SquaresFour;
  return <Icon size={size} color={color || undefined} weight="regular" />;
}

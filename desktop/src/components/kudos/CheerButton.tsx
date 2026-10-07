import type { ReactNode } from "react";
import { HandsClapping } from "@phosphor-icons/react";
import { ThemedText } from "@/components/ThemedText";
import { cn } from "@/lib/utils";

// Spark directions around the icon (px), staggered so they read as a little burst.
const SPARKS = [
  { x: "-12px", y: "-14px", delay: "0ms" },
  { x: "12px", y: "-12px", delay: "40ms" },
  { x: "-14px", y: "8px", delay: "80ms" },
  { x: "14px", y: "10px", delay: "20ms" },
];

/** Clapping-hands kudos button: hover claps and throws sparks, press squishes. */
export function CheerIcon({ size = 16 }: { size?: number }) {
  return (
    <span className="relative inline-grid place-items-center">
      <HandsClapping size={size} weight="fill" className="cheer-icon" />
      {SPARKS.map((s, i) => (
        <span
          key={i}
          aria-hidden
          className="cheer-spark pointer-events-none absolute size-1 rounded-full bg-current"
          style={{ ["--spark-x" as string]: s.x, ["--spark-y" as string]: s.y, animationDelay: s.delay }}
        />
      ))}
    </span>
  );
}

export function CheerButton({
  onClick,
  children,
  primary = true,
  className,
}: {
  onClick: () => void;
  children: ReactNode;
  primary?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "cheer inline-flex h-9 items-center gap-2 rounded-full px-4 transition-[transform,box-shadow,background-color,color] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.95]",
        primary
          ? "bg-primary text-primary-foreground shadow-[0_6px_10px_-2px_rgba(133,77,255,0.3)] hover:shadow-[0_10px_22px_-4px_rgba(133,77,255,0.5)]"
          : "bg-primary/10 text-primary hover:bg-primary/15 hover:shadow-[0_8px_18px_-8px_rgba(133,77,255,0.45)]",
        className
      )}
    >
      <CheerIcon />
      <ThemedText type="caption" className="text-inherit">
        {children}
      </ThemedText>
    </button>
  );
}

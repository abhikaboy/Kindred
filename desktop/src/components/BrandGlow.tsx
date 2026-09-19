import { useEffect, type RefObject } from "react";
import { useTheme } from "@/lib/theme";

// Ambient brand orbs behind the app content. The soft radial falloff is the
// "blur" (no filter: blur, which is expensive). They drift + breathe via
// transform only (GPU-composited, no repaint); keyframes live in index.css and
// are disabled under prefers-reduced-motion. Purple (#854DFF) + faint blue (#4D9EFF).
const ORBS = [
  { rgb: "133,77,255", size: 42, top: 6, left: 2, peak: 0.035, anim: "brand-drift-a", dur: 34, delay: 0 },
  { rgb: "133,77,255", size: 34, top: 16, left: 80, peak: 0.028, anim: "brand-drift-b", dur: 46, delay: -12 },
  { rgb: "77,158,255", size: 46, top: 66, left: 62, peak: 0.024, anim: "brand-drift-c", dur: 52, delay: -20 },
  { rgb: "133,77,255", size: 30, top: 62, left: 20, peak: 0.024, anim: "brand-drift-b", dur: 40, delay: -6 },
];

export function BrandGlow({
  scrollRef,
  hostRef,
}: {
  /** The scroll container to parallax against. */
  scrollRef: RefObject<HTMLElement | null>;
  /** Element that carries the --brand-scroll var the orbs read. */
  hostRef: RefObject<HTMLElement | null>;
}) {
  // Light mode reads cleaner as flat white — the purple wash only earns its keep
  // against the dark palette, so the orbs are dark-only.
  const { theme } = useTheme();
  const enabled = theme === "dark";

  // Writing --brand-scroll invalidates style for the whole subtree under the host,
  // so do it at most once per frame, and only while the orbs are actually on
  // screen. Previously this ran on every scroll event in both themes.
  useEffect(() => {
    const el = scrollRef.current;
    if (!enabled || !el) return;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        hostRef.current?.style.setProperty("--brand-scroll", String(el.scrollTop));
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
      hostRef.current?.style.removeProperty("--brand-scroll");
    };
  }, [enabled, scrollRef, hostRef]);

  if (!enabled) return null;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {/* Parallax: --brand-scroll (set by main's onScroll) drifts the orbs up slower than content. */}
      <div
        data-brand-parallax
        className="absolute inset-0"
        style={{ transform: "translate3d(0, calc(var(--brand-scroll, 0) * -0.12px), 0)" }}
      >
        {ORBS.map((o, i) => (
          <div
            key={i}
            data-brand-orb
            style={{
              position: "absolute",
              top: `${o.top}%`,
              left: `${o.left}%`,
              width: `${o.size}rem`,
              height: `${o.size}rem`,
              background: `radial-gradient(circle, rgba(${o.rgb},${o.peak}), transparent 62%)`,
              animation: `${o.anim} ${o.dur}s ease-in-out ${o.delay}s infinite`,
              willChange: "transform",
            }}
          />
        ))}
      </div>
    </div>
  );
}

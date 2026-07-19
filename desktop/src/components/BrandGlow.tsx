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

export function BrandGlow() {
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

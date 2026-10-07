import { cn } from "@/lib/utils";

// Port of mobile GlowBackground's "wash": an ellipse anchored near the top (cy 10%,
// rx 110%, ry 70%) whose edge is the tinted arc, plus a halftone band riding that edge.
// Stops, tints and timings mirror frontend/components/ui/GlowBackground.tsx.
const ARC = "110% 70% at 50% 10%";

export function StageGlow({ focused, replayKey }: { focused: boolean; replayKey: number }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        key={replayKey}
        className={cn(
          "stage-wash-drop absolute inset-0 transition-transform duration-[900ms] ease-[cubic-bezier(0.05,0.7,0.1,1)]",
          focused && "stage-wash-lifted"
        )}
      >
        <div className="stage-wash-breathe absolute inset-0">
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(${ARC}, rgb(var(--wash-tint) / 0) 62%, rgb(var(--wash-tint) / 0.3) 85%, rgb(var(--wash-tint) / 0.55) 100%)`,
            }}
          />
          <div
            className="stage-wash-dots absolute inset-0"
            style={{
              // Two dots per 10px tile gives the staggered diamond lattice.
              backgroundImage:
                "radial-gradient(circle at 2.5px 2.5px, rgb(var(--wash-dot)) 1.1px, transparent 1.6px), radial-gradient(circle at 7.5px 7.5px, rgb(var(--wash-dot)) 1.1px, transparent 1.6px)",
              backgroundSize: "10px 10px",
              maskImage: `radial-gradient(${ARC}, transparent 58%, #000 70%, rgb(0 0 0 / 0.35) 84%, transparent 95%)`,
              WebkitMaskImage: `radial-gradient(${ARC}, transparent 58%, #000 70%, rgb(0 0 0 / 0.35) 84%, transparent 95%)`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

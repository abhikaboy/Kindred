import confetti from "canvas-confetti";

// Brand-tinted palette (purple → lavender → white + a warm accent) so the burst
// reads as Kindred rather than default rainbow.
const COLORS = ["#854DFF", "#A855F7", "#C4B5FD", "#FFFFFF", "#FDE68A"];

// The canonical celebration — one burst per task completion, anchored to the
// element that triggered it (falls back to lower-center). Mirrors the mobile cannon.
export function fireConfetti(anchor?: HTMLElement | null): void {
  let origin = { x: 0.5, y: 0.65 };
  if (anchor) {
    const r = anchor.getBoundingClientRect();
    origin = {
      x: (r.left + r.width / 2) / window.innerWidth,
      y: (r.top + r.height / 2) / window.innerHeight,
    };
  }
  confetti({
    particleCount: 70,
    spread: 62,
    startVelocity: 42,
    scalar: 0.82,
    gravity: 0.9,
    ticks: 220,
    colors: COLORS,
    origin,
    disableForReducedMotion: true,
  });
}

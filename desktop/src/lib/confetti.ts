import confetti from "canvas-confetti";

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
  confetti({ particleCount: 80, spread: 70, startVelocity: 45, scalar: 0.9, origin });
}

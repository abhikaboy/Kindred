import { createContext, useCallback, useContext, useRef, useState } from "react";
import { hitTest, type DropRect } from "@/lib/dragHitTest";

type Point = { x: number; y: number };
type DragState = { dragging: { taskId: string } | null; hoverKey: string | null; pointer: Point | null };

type DragCtx = DragState & {
  startDrag: (taskId: string, e: React.PointerEvent, opts?: { grabOffsetY?: number; onClick?: () => void }) => void;
  registerTarget: (key: string, el: HTMLElement | null) => void;
};

const Ctx = createContext<DragCtx | null>(null);

export function useDrag(): DragCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDrag must be used within DragProvider");
  return ctx;
}

export function useDragState(): DragState {
  const { dragging, hoverKey, pointer } = useDrag();
  return { dragging, hoverKey, pointer };
}

// Ref-callback for a drop target; register on mount, unregister on unmount.
export function useDropTarget(key: string): (el: HTMLElement | null) => void {
  const { registerTarget } = useDrag();
  return useCallback((el) => registerTarget(key, el), [key, registerTarget]);
}

export function DragProvider({
  children,
  onDrop,
}: {
  children: React.ReactNode;
  onDrop?: (taskId: string, dropKey: string, point: Point, grabOffsetY: number) => void;
}) {
  const targets = useRef(new Map<string, HTMLElement>());
  const [dragging, setDragging] = useState<{ taskId: string } | null>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [pointer, setPointer] = useState<Point | null>(null);

  const registerTarget = useCallback((key: string, el: HTMLElement | null) => {
    if (el) targets.current.set(key, el);
    else targets.current.delete(key);
  }, []);

  const liveRects = (): DropRect[] =>
    [...targets.current.entries()].map(([key, el]) => {
      const r = el.getBoundingClientRect();
      return { key, left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    });

  const startDrag = useCallback(
    (taskId: string, e: React.PointerEvent, opts?: { grabOffsetY?: number; onClick?: () => void }) => {
      e.preventDefault();
      const origin = { x: e.clientX, y: e.clientY };
      const offsetY = opts?.grabOffsetY ?? 0;
      let started = false;

      const move = (ev: PointerEvent) => {
        const point = { x: ev.clientX, y: ev.clientY };
        if (!started) {
          if (Math.hypot(ev.clientX - origin.x, ev.clientY - origin.y) < 4) return;
          started = true;
          setDragging({ taskId });
        }
        setPointer(point);
        setHoverKey(hitTest(point, liveRects()));
      };
      const up = (ev: PointerEvent) => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        if (!started) {
          opts?.onClick?.();
          return;
        }
        const point = { x: ev.clientX, y: ev.clientY };
        const key = hitTest(point, liveRects());
        if (key) onDrop?.(taskId, key, point, offsetY);
        setDragging(null);
        setHoverKey(null);
        setPointer(null);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [onDrop]
  );

  return (
    <Ctx.Provider value={{ dragging, hoverKey, pointer, startDrag, registerTarget }}>{children}</Ctx.Provider>
  );
}

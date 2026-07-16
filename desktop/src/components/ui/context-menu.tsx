import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

// A small custom right-click menu. We drive it off the native `contextmenu` event
// (preventDefault to suppress the browser menu) rather than a library primitive, so
// it behaves consistently in the desktop webview. Same API shape as a shadcn menu.

type Pos = { x: number; y: number };
type Ctx = { open: boolean; pos: Pos; openAt: (p: Pos) => void; close: () => void };

const ContextMenuCtx = createContext<Ctx | null>(null);

function useCtx(): Ctx {
  const c = useContext(ContextMenuCtx);
  if (!c) throw new Error("ContextMenu parts must be used within <ContextMenu>");
  return c;
}

export function ContextMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos>({ x: 0, y: 0 });
  const openAt = useCallback((p: Pos) => {
    setPos(p);
    setOpen(true);
  }, []);
  const close = useCallback(() => setOpen(false), []);
  return (
    <ContextMenuCtx.Provider value={{ open, pos, openAt, close }}>{children}</ContextMenuCtx.Provider>
  );
}

export function ContextMenuTrigger({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { openAt } = useCtx();
  return (
    <div
      className={className}
      onContextMenu={(e) => {
        e.preventDefault();
        openAt({ x: e.clientX, y: e.clientY });
      }}
    >
      {children}
    </div>
  );
}

export function ContextMenuContent({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const { open, pos, close } = useCtx();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onScroll = () => close();
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, close]);

  if (!open) return null;

  return createPortal(
    // Full-screen catcher closes on any outside press or a new right-click.
    <div
      className="fixed inset-0 z-50"
      onPointerDown={close}
      onContextMenu={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <div
        role="menu"
        style={{ position: "fixed", left: pos.x, top: pos.y }}
        onPointerDown={(e) => e.stopPropagation()}
        className={cn(
          "min-w-[10rem] rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
          className
        )}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

export function ContextMenuItem({
  className,
  variant,
  disabled,
  onClick,
  children,
}: {
  className?: string;
  variant?: "destructive";
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  const { close } = useCtx();
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={() => {
        onClick?.();
        close();
      }}
      className={cn(
        "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50",
        variant === "destructive" && "text-destructive hover:text-destructive",
        className
      )}
    >
      {children}
    </button>
  );
}

export function ContextMenuSeparator({ className }: { className?: string }) {
  return <div className={cn("-mx-1 my-1 h-px bg-border", className)} />;
}

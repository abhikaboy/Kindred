import { useEffect, useRef, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/auth";
import { AppSidebar } from "@/components/AppSidebar";
import { FloatingRings } from "@/components/FloatingRings";
import { CreateProvider } from "@/components/create/CreateContext";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

const MIN_WIDTH = 220;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 272; // a touch roomier than the shadcn default (16rem)
const WIDTH_KEY = "kindred-sidebar-width";

// Drag handle on the sidebar's right edge; only shown while expanded on desktop.
function SidebarResizer({ onWidth }: { onWidth: (w: number) => void }) {
  const { state, isMobile } = useSidebar();
  const dragging = useRef(false);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      onWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX)));
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.userSelect = "";
      onWidth(-1); // signal: persist current width
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [onWidth]);

  if (state !== "expanded" || isMobile) return null;

  return (
    <div
      onPointerDown={() => {
        dragging.current = true;
        document.body.style.userSelect = "none";
      }}
      className="fixed inset-y-0 z-20 w-1.5 -translate-x-1/2 cursor-col-resize rounded-full transition-colors hover:bg-sidebar-border"
      style={{ left: "var(--sidebar-width)" }}
      aria-hidden
    />
  );
}

export default function AppLayout() {
  const { user, isLoading } = useAuth();
  const [width, setWidth] = useState<number>(() => {
    const saved = Number(localStorage.getItem(WIDTH_KEY));
    return saved >= MIN_WIDTH && saved <= MAX_WIDTH ? saved : DEFAULT_WIDTH;
  });

  // -1 is the "persist" signal from the resizer's pointer-up.
  const handleWidth = (w: number) => {
    if (w === -1) {
      setWidth((cur) => {
        localStorage.setItem(WIDTH_KEY, String(cur));
        return cur;
      });
      return;
    }
    setWidth(w);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Skeleton className="size-10 rounded-full" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;

  return (
    <SidebarProvider style={{ "--sidebar-width": `${width}px` } as React.CSSProperties}>
      <CreateProvider>
        <AppSidebar />
        <SidebarResizer onWidth={handleWidth} />
        <SidebarInset className="h-svh overflow-hidden">
          <header className="flex h-14 items-center gap-2 px-4">
            <SidebarTrigger />
          </header>
          <main className="min-h-0 flex-1 overflow-y-auto px-6 pb-12">
            <Outlet />
          </main>
          <FloatingRings />
        </SidebarInset>
      </CreateProvider>
    </SidebarProvider>
  );
}

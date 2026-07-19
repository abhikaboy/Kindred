import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
// Named imports tree-shake; the full set is only pulled via WorkspaceIcon's lazy import.
import {
  House,
  CalendarBlank,
  Newspaper,
  MagnifyingGlass,
  Plus,
  User,
  GearSix,
  SignOut,
} from "@phosphor-icons/react";
import { useAuth } from "@/contexts/auth";
import { useCreate } from "@/components/create/CreateContext";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { ThemedText } from "@/components/ThemedText";
import { ThemeToggle } from "@/components/ThemeToggle";
import { WorkspaceIcon } from "@/components/WorkspaceIcon";
import { NotificationBell } from "@/components/NotificationBell";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar";

const MAIN = [
  { title: "Home", url: "/", icon: House, shortcut: "⇧H" },
  { title: "Calendar", url: "/calendar", icon: CalendarBlank, shortcut: "⇧C" },
  { title: "Feed", url: "/feed", icon: Newspaper },
  // Search now covers both people and blueprints (see routes/search.tsx).
  { title: "Search", url: "/search", icon: MagnifyingGlass },
  { title: "Profile", url: "/profile", icon: User },
] as const;

// Shift + <key> jumps to a page. Skipped while typing so a capital H/C in a
// task title doesn't teleport you.
const SHORTCUTS: Record<string, string> = { H: "/", C: "/calendar" };

export function AppSidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { openCreateTask, openCreateWorkspace } = useCreate();
  const workspaces = useWorkspaces();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      const key = e.key.toUpperCase();
      const to = SHORTCUTS[key];
      if (to) {
        e.preventDefault();
        navigate(to);
      } else if (key === "T") {
        e.preventDefault();
        openCreateTask();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, openCreateTask]);

  return (
    <Sidebar variant="floating" collapsible="offcanvas">
      <SidebarHeader className="px-2 py-2">
        <div className="flex items-center justify-between gap-2">
          <ThemedText type="titleFraunces" className="text-2xl">
            Kindred
          </ThemedText>
          <NotificationBell />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => openCreateTask()}
                  tooltip="New task"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
                >
                  <Plus weight="bold" />
                  <span>New task</span>
                  <kbd className="ml-auto text-xs font-medium tracking-wide text-primary-foreground/50">⇧T</kbd>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {MAIN.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    isActive={pathname === item.url}
                    tooltip={item.title}
                    render={<Link to={item.url} />}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                    {"shortcut" in item && item.shortcut ? (
                      <kbd className="ml-auto text-xs font-medium tracking-wide text-muted-foreground/40">
                        {item.shortcut}
                      </kbd>
                    ) : null}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Workspaces</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {workspaces.isLoading &&
                [0, 1, 2].map((i) => (
                  <SidebarMenuItem key={i}>
                    <SidebarMenuSkeleton showIcon />
                  </SidebarMenuItem>
                ))}
              {workspaces.data?.map((ws) => {
                const url = `/workspace/${encodeURIComponent(ws.name)}`;
                return (
                  <SidebarMenuItem key={ws.name}>
                    <SidebarMenuButton
                      isActive={pathname === url}
                      tooltip={ws.name}
                      render={<Link to={url} />}
                    >
                      <WorkspaceIcon name={ws.icon} color={ws.color} />
                      <span>{ws.name}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => openCreateWorkspace()}
                  className="text-muted-foreground"
                  tooltip="New workspace"
                >
                  <Plus />
                  <span>New workspace</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={pathname === "/settings"}
              tooltip="Settings"
              render={<Link to="/settings" />}
            >
              <GearSix />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={logout} tooltip="Log out">
              <SignOut />
              <span>Log out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="flex items-center justify-between px-2 py-1">
          <ThemedText type="caption">Theme</ThemedText>
          <ThemeToggle />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

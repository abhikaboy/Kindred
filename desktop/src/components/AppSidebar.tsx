import { Link, useLocation } from "react-router-dom";
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
  { title: "Home", url: "/", icon: House },
  { title: "Calendar", url: "/calendar", icon: CalendarBlank },
  { title: "Feed", url: "/feed", icon: Newspaper },
  // Search now covers both people and blueprints (see routes/search.tsx).
  { title: "Search", url: "/search", icon: MagnifyingGlass },
  { title: "Profile", url: "/profile", icon: User },
] as const;

export function AppSidebar() {
  const { pathname } = useLocation();
  const { logout } = useAuth();
  const { openCreateTask, openCreateWorkspace } = useCreate();
  const workspaces = useWorkspaces();

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

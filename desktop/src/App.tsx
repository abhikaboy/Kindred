import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/auth";
import { Skeleton } from "@/components/ui/skeleton";
import AppLayout from "@/routes/Layout";
import LoginScreen from "@/routes/login";
import RegisterScreen from "@/routes/register";
import HomeScreen from "@/routes/home";
import CalendarScreen from "@/routes/calendar";
import FeedScreen from "@/routes/feed";
import SearchScreen from "@/routes/search";
import FriendsScreen from "@/routes/friends";
import ActivityScreen from "@/routes/activity";
import NotificationsScreen from "@/routes/notifications";
import WorkspaceScreen from "@/routes/workspace";
import TaskDetailScreen from "@/routes/task";
import PostDetailScreen from "@/routes/post";
import ProfileScreen from "@/routes/profile";
import AccountScreen from "@/routes/account";
import SettingsScreen from "@/routes/settings";
import { PagePlaceholder } from "@/components/PagePlaceholder";

function CenteredLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Skeleton className="size-10 rounded-full" />
    </div>
  );
}

// Auth-only routes redirect to home once a session exists.
function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <CenteredLoader />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<AuthRoute><LoginScreen /></AuthRoute>} />
          <Route path="/register" element={<AuthRoute><RegisterScreen /></AuthRoute>} />

          <Route element={<AppLayout />}>
            <Route path="/" element={<HomeScreen />} />
            <Route path="/calendar" element={<CalendarScreen />} />
            <Route path="/feed" element={<FeedScreen />} />
            <Route path="/search" element={<SearchScreen />} />
            <Route path="/friends" element={<FriendsScreen />} />
            <Route path="/notifications" element={<NotificationsScreen />} />
            <Route path="/activity" element={<ActivityScreen />} />
            <Route path="/workspace/:name" element={<WorkspaceScreen />} />
            <Route path="/task/:id" element={<TaskDetailScreen />} />
            <Route path="/post/:id" element={<PostDetailScreen />} />
            <Route path="/profile" element={<ProfileScreen />} />
            <Route path="/account/:id" element={<AccountScreen />} />
            <Route path="/profile/edit" element={<PagePlaceholder title="Edit profile" />} />
            <Route path="/settings" element={<SettingsScreen />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

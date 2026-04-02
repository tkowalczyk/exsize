import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/auth";
import AppLayout from "@/layouts/AppLayout";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import FamilyPage from "@/pages/FamilyPage";
import TasksPage from "@/pages/TasksPage";
import ExBucksPage from "@/pages/ExBucksPage";
import RewardsPage from "@/pages/RewardsPage";
import ShopPage from "@/pages/ShopPage";
import ProfilePage from "@/pages/ProfilePage";
import DashboardPage from "@/pages/DashboardPage";
import SettingsPage from "@/pages/SettingsPage";
import AdminSettingsPage from "@/pages/AdminSettingsPage";
import LeaderboardPage from "@/pages/LeaderboardPage";
import SizePassPage from "@/pages/SizePassPage";
import AvatarItemsPage from "@/pages/AvatarItemsPage";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AuthenticatedRoutes() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <AppLayout user={user}>
      <Routes>
        <Route path="/dashboard" element={<DashboardPage user={user} />} />
        <Route path="/tasks" element={<TasksPage user={user} />} />
        <Route path="/family" element={<FamilyPage user={user} />} />
        <Route path="/exbucks" element={<ExBucksPage user={user} />} />
        <Route path="/shop" element={<ShopPage user={user} />} />
        <Route path="/profile" element={<ProfilePage user={user} />} />
        <Route path="/profile/:childId" element={<ProfilePage user={user} />} />
        <Route path="/rewards" element={<RewardsPage user={user} />} />
        <Route path="/admin-settings" element={<AdminSettingsPage user={user} />} />
        <Route path="/avatar-items" element={<AvatarItemsPage user={user} />} />
        <Route path="/leaderboard" element={<LeaderboardPage user={user} />} />
        <Route path="/sizepass" element={<SizePassPage user={user} />} />
        <Route path="/settings" element={<SettingsPage user={user} />} />
        <Route
          path="*"
          element={
            <Navigate
              to={user.role === "child" ? "/tasks" : "/dashboard"}
              replace
            />
          }
        />
      </Routes>
    </AppLayout>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <AuthenticatedRoutes />
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

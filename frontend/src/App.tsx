import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/auth";
import AppLayout from "@/layouts/AppLayout";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import FamilyPage from "@/pages/FamilyPage";

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
        <Route path="/dashboard" element={<div>Dashboard</div>} />
        <Route path="/tasks" element={<div>Tasks</div>} />
        <Route path="/family" element={<FamilyPage user={user} />} />
        <Route path="/shop" element={<div>Shop</div>} />
        <Route path="/profile" element={<div>Profile</div>} />
        <Route path="/rewards" element={<div>Rewards</div>} />
        <Route path="/settings" element={<div>Settings</div>} />
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

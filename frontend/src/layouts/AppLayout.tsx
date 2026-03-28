import { type ReactNode, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getBalance, getGamificationProfile, type UserResponse } from "@/api";
import { useAuth } from "@/auth";

const NAV_ITEMS: Record<string, { label: string; to: string }[]> = {
  parent: [
    { label: "Dashboard", to: "/dashboard" },
    { label: "Tasks", to: "/tasks" },
    { label: "Family", to: "/family" },
    { label: "ExBucks", to: "/exbucks" },
    { label: "Settings", to: "/settings" },
  ],
  child: [
    { label: "Tasks", to: "/tasks" },
    { label: "Family", to: "/family" },
    { label: "ExBucks", to: "/exbucks" },
    { label: "Shop", to: "/shop" },
    { label: "Leaderboard", to: "/leaderboard" },
    { label: "Profile", to: "/profile" },
    { label: "Settings", to: "/settings" },
  ],
  admin: [
    { label: "Dashboard", to: "/dashboard" },
    { label: "Tasks", to: "/tasks" },
    { label: "Family", to: "/family" },
    { label: "ExBucks", to: "/exbucks" },
    { label: "Rewards", to: "/rewards" },
    { label: "Settings", to: "/settings" },
  ],
};

interface AppLayoutProps {
  user: UserResponse;
  children: ReactNode;
}

function useDarkMode() {
  const [dark, setDark] = useState(() => {
    try {
      const stored = localStorage.getItem("theme");
      if (stored) return stored === "dark";
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try {
      localStorage.setItem("theme", dark ? "dark" : "light");
    } catch {
      // localStorage unavailable in test env
    }
  }, [dark]);

  return [dark, () => setDark((d) => !d)] as const;
}

export default function AppLayout({ user, children }: AppLayoutProps) {
  const { logout } = useAuth();
  const [dark, toggleDark] = useDarkMode();
  const navItems = NAV_ITEMS[user.role] ?? NAV_ITEMS.parent;

  const { data: balanceData } = useQuery({
    queryKey: ["exbucks-balance"],
    queryFn: getBalance,
    retry: false,
    enabled: user.role === "child",
  });

  const { data: profileData } = useQuery({
    queryKey: ["gamification-profile"],
    queryFn: getGamificationProfile,
    retry: false,
    enabled: user.role === "child",
  });

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <nav className="flex gap-4">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {user.role === "child" && profileData != null && (
              <Link
                to="/profile"
                className="flex items-center gap-2 rounded-full border-2 border-primary bg-primary/10 px-4 py-1.5 font-bold text-primary transition-colors hover:bg-primary/20"
                aria-label="Streak"
              >
                <span className="text-2xl">🔥</span>
                <span className="text-lg">{profileData.streak}</span>
              </Link>
            )}
            {user.role === "child" && profileData != null && (
              <Link
                to="/profile"
                className="flex items-center gap-2 rounded-full border-2 border-primary bg-primary/10 px-4 py-1.5 font-bold text-primary transition-colors hover:bg-primary/20"
                aria-label="Level"
              >
                <span className="text-2xl">⭐</span>
                <span className="text-lg">{profileData.level}</span>
              </Link>
            )}
            {user.role === "child" && balanceData != null && (
              <Link
                to="/exbucks"
                className="flex items-center gap-2 rounded-full border-2 border-primary bg-primary/10 px-4 py-1.5 font-bold text-primary transition-colors hover:bg-primary/20"
                aria-label="ExBucks balance"
              >
                <span className="text-2xl">💰</span>
                <span className="text-lg">{balanceData.balance}</span>
              </Link>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleDark}
              aria-label="Toggle dark mode"
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={logout}>
              Logout
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}

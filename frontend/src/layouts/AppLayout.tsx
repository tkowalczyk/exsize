import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import type { UserResponse } from "@/api";
import { useAuth } from "@/auth";

const NAV_ITEMS: Record<string, { label: string; to: string }[]> = {
  parent: [
    { label: "Dashboard", to: "/dashboard" },
    { label: "Tasks", to: "/tasks" },
    { label: "Family", to: "/family" },
    { label: "Settings", to: "/settings" },
  ],
  child: [
    { label: "Tasks", to: "/tasks" },
    { label: "Family", to: "/family" },
    { label: "Shop", to: "/shop" },
    { label: "Profile", to: "/profile" },
    { label: "Settings", to: "/settings" },
  ],
  admin: [
    { label: "Dashboard", to: "/dashboard" },
    { label: "Tasks", to: "/tasks" },
    { label: "Family", to: "/family" },
    { label: "Rewards", to: "/rewards" },
    { label: "Settings", to: "/settings" },
  ],
};

interface AppLayoutProps {
  user: UserResponse;
  children: ReactNode;
}

export default function AppLayout({ user, children }: AppLayoutProps) {
  const { logout } = useAuth();
  const navItems = NAV_ITEMS[user.role] ?? NAV_ITEMS.parent;

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
          <Button variant="ghost" size="sm" onClick={logout}>
            Logout
          </Button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}

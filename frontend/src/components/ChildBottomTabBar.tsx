import { useState, useEffect, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ListTodo, ShoppingBag, Trophy, Menu, User, Settings, Users, Coins, Sparkles } from "lucide-react";

const tabs = [
  { label: "Tasks", to: "/tasks", icon: ListTodo },
  { label: "Shop", to: "/shop", icon: ShoppingBag },
  { label: "Leaderboard", to: "/leaderboard", icon: Trophy },
];

const drawerItems = [
  { label: "Profile", to: "/profile", icon: User },
  { label: "Settings", to: "/settings", icon: Settings },
  { label: "Family", to: "/family", icon: Users },
  { label: "ExBucks", to: "/exbucks", icon: Coins },
  { label: "SizePass", to: "/sizepass", icon: Sparkles },
];

export default function ChildBottomTabBar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  useEffect(() => {
    if (!drawerOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeDrawer();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen, closeDrawer]);

  function handleDrawerNav(to: string) {
    closeDrawer();
    navigate(to);
  }

  return (
    <>
      <nav className="child-bottom-tab-bar fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t bg-background px-2 pb-[env(safe-area-inset-bottom)] md:hidden">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = pathname === tab.to || pathname.startsWith(tab.to + "/");
          return (
            <Link
              key={tab.label}
              to={tab.to}
              aria-label={tab.label}
              aria-current={isActive ? "page" : undefined}
              className={`tab-item flex flex-col items-center gap-1 px-3 py-2 text-muted-foreground ${isActive ? "text-foreground font-semibold" : ""}`}
            >
              <Icon className="h-6 w-6" />
              <span className="text-xs">{tab.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          aria-label="Menu"
          onClick={() => setDrawerOpen(true)}
          className="tab-item flex flex-col items-center gap-1 px-3 py-2 text-muted-foreground"
        >
          <Menu className="h-6 w-6" />
          <span className="text-xs">Menu</span>
        </button>
      </nav>

      {drawerOpen && (
        <>
          <div
            data-testid="drawer-backdrop"
            className="fixed inset-0 z-50 bg-black/40"
            onClick={closeDrawer}
          />
          <aside
            role="dialog"
            className="child-drawer fixed right-0 top-0 bottom-0 z-50 w-64 bg-background p-4 shadow-xl"
          >
            <nav className="flex flex-col gap-2">
              {drawerItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    type="button"
                    aria-label={item.label}
                    onClick={() => handleDrawerNav(item.to)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </aside>
        </>
      )}
    </>
  );
}

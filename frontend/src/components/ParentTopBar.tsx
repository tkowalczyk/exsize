import { Link } from "react-router-dom";
import { Settings, Users, Moon, Sun, LogOut } from "lucide-react";

const SIZEPASS_COLORS = [
  "#ff6b6b", "#ffa502", "#ffd93d", "#6bcb77",
  "#4d96ff", "#9b59b6", "#e84393", "#00cec9",
];

interface ParentTopBarProps {
  dark: boolean;
  toggleDark: () => void;
  logout: () => void;
}

export default function ParentTopBar({ dark, toggleDark, logout }: ParentTopBarProps) {
  return (
    <header className="parent-top-bar sticky top-0 z-40 border-b bg-background md:hidden">
      <div className="flex h-12 items-center justify-between px-4">
        <div className="flex items-center gap-5">
          <Link to="/settings" aria-label="Settings" className="text-muted-foreground hover:text-foreground">
            <Settings className="h-6 w-6" />
          </Link>
          <Link to="/family" aria-label="Family" className="text-muted-foreground hover:text-foreground">
            <Users className="h-6 w-6" />
          </Link>
          <button
            type="button"
            aria-label="Toggle dark mode"
            onClick={toggleDark}
            className="text-muted-foreground hover:text-foreground"
          >
            {dark ? <Sun className="h-6 w-6" /> : <Moon className="h-6 w-6" />}
          </button>
        </div>
        <div className="flex items-center gap-5">
          <Link
            to="/sizepass"
            aria-label="SizePass"
            className="flex items-center rounded-full border-2 border-primary/50 px-3 py-1 text-sm font-bold"
          >
            {"SizePass".split("").map((letter, i) => (
              <span
                key={i}
                className="sizepass-letter"
                style={{ color: SIZEPASS_COLORS[i], animationDelay: `${i * 0.15}s` }}
              >
                {letter}
              </span>
            ))}
          </Link>
          <button
            type="button"
            aria-label="Logout"
            onClick={logout}
            className="text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-6 w-6" />
          </button>
        </div>
      </div>
    </header>
  );
}

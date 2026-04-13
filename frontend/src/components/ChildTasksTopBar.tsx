interface ChildTasksTopBarProps {
  badges: string[];
  streak: number;
  level: number;
  exbucksBalance: number;
}

export default function ChildTasksTopBar({ badges, streak, level, exbucksBalance }: ChildTasksTopBarProps) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background md:hidden">
      <div className="flex h-12 items-center justify-center px-4">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <span aria-label="Badges" className="flex items-center gap-1 rounded-full border-2 border-green-500 px-3 py-1 text-base">
            <span>🏆</span>
            <span>{badges.length}</span>
          </span>
          <span aria-label="Streak" className="flex items-center gap-1 rounded-full border-2 border-green-500 px-3 py-1 text-base">
            <span>🔥</span>
            <span>{streak}</span>
          </span>
          <span aria-label="Level" className="flex items-center gap-1 rounded-full border-2 border-green-500 px-3 py-1 text-base">
            <span>⭐</span>
            <span>{level}</span>
          </span>
          <span aria-label="ExBucks balance" className="flex items-center gap-1 rounded-full border-2 border-green-500 px-3 py-1 text-base">
            <span>💰</span>
            <span>{exbucksBalance}</span>
          </span>
        </div>
      </div>
    </header>
  );
}

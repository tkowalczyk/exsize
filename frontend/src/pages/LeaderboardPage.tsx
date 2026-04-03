import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Avatar from "@/components/Avatar";
import {
  getLeaderboard,
  getGlobalLeaderboard,
  ApiError,
  type UserResponse,
  type GlobalLeaderboardEntry,
} from "@/api";

interface LeaderboardPageProps {
  user: UserResponse;
}

function GlobalTab({ user }: { user: UserResponse }) {
  const { data, isLoading } = useQuery({
    queryKey: ["globalLeaderboard"],
    queryFn: getGlobalLeaderboard,
  });

  if (isLoading) return <div>Loading...</div>;
  if (!data) return null;

  return (
    <Card>
      <CardContent className="pt-6">
        {data.entries.length === 0 && (
          <p className="text-sm text-muted-foreground">No entries yet.</p>
        )}
        <div className="space-y-3">
          {data.entries.map((entry) => (
            <LeaderboardRow key={entry.id} entry={entry} isCurrentUser={entry.id === user.id} />
          ))}
        </div>

        {data.user_entry && (
          <>
            <div className="my-4 border-t" />
            <LeaderboardRow entry={data.user_entry} isCurrentUser />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function LeaderboardRow({
  entry,
  isCurrentUser,
}: {
  entry: GlobalLeaderboardEntry;
  isCurrentUser: boolean;
}) {
  const displayName = entry.nickname ?? entry.email;

  return (
    <div
      className={`flex items-center justify-between rounded-lg border p-3 ${
        isCurrentUser ? "border-primary bg-primary/5" : ""
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="w-8 text-center text-lg font-bold text-muted-foreground">
          {entry.position}
        </span>
        <Avatar icon={entry.avatar_icon} background={entry.avatar_background} size="sm" />
        <div>
          <p className="font-medium">{displayName}</p>
          <p className="text-sm text-muted-foreground">
            Level {entry.level} · {entry.streak} streak
          </p>
        </div>
      </div>
      <span className="font-semibold">{entry.xp} XP</span>
    </div>
  );
}

function FamilyTab() {
  const {
    data: leaderboard,
    error,
    isLoading,
  } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: getLeaderboard,
    retry: false,
  });

  if (isLoading) return <div>Loading...</div>;

  if (error instanceof ApiError && error.status === 403) {
    return (
      <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
        <CardHeader>
          <CardTitle>SizePass Required</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Sibling leaderboard requires SizePass. Upgrade to access.
          </p>
          <Link to="/sizepass">
            <Button variant="default">Upgrade to SizePass</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (!leaderboard || leaderboard.entries.length === 0) return null;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-3">
          {leaderboard.entries.map((entry, index) => (
            <div
              key={entry.id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-muted-foreground">
                  #{index + 1}
                </span>
                <div>
                  <p className="font-medium">{entry.nickname ?? entry.email}</p>
                  <p className="text-sm text-muted-foreground">
                    Level {entry.level}
                  </p>
                </div>
              </div>
              <span className="font-semibold">{entry.xp} XP</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function LeaderboardPage({ user }: LeaderboardPageProps) {
  const [tab, setTab] = useState<"global" | "family">("global");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Leaderboard</h1>
      <div className="flex gap-2">
        <Button
          variant={tab === "global" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("global")}
        >
          Global
        </Button>
        <Button
          variant={tab === "family" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("family")}
        >
          Family
        </Button>
      </div>
      {tab === "global" ? <GlobalTab user={user} /> : <FamilyTab />}
    </div>
  );
}

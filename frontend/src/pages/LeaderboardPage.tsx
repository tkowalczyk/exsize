import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getLeaderboard, ApiError, type UserResponse } from "@/api";

interface LeaderboardPageProps {
  user: UserResponse;
}

export default function LeaderboardPage({ user }: LeaderboardPageProps) {
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
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Leaderboard</h1>
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
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Leaderboard</h1>
      {leaderboard && leaderboard.entries.length > 0 && (
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
                      <p className="font-medium">{entry.email}</p>
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
      )}
    </div>
  );
}

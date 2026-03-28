import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getSubscription, checkout, type UserResponse } from "@/api";

interface SettingsPageProps {
  user: UserResponse;
}

export default function SettingsPage({ user }: SettingsPageProps) {
  const [comingSoon, setComingSoon] = useState(false);

  const { data: subscription } = useQuery({
    queryKey: ["subscription"],
    queryFn: getSubscription,
    retry: false,
  });

  async function handleUpgrade() {
    try {
      await checkout();
    } catch {
      setComingSoon(true);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {subscription && (
            <>
              <div className="flex items-center gap-3">
                <span className="text-lg font-semibold">
                  {subscription.plan === "free" ? "Free" : "SizePass"}
                </span>
                {subscription.plan !== "free" && (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    Active
                  </span>
                )}
              </div>
              {subscription.plan === "free" && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
                  <p className="mb-2 text-sm text-muted-foreground">
                    Upgrade to SizePass for leaderboards, advanced stats, photo
                    proof, and more.
                  </p>
                  {comingSoon ? (
                    <p className="text-sm font-medium text-primary">
                      SizePass is coming soon!
                    </p>
                  ) : (
                    <Button variant="default" onClick={handleUpgrade}>
                      Upgrade to SizePass
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

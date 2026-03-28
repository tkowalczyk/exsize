import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getSubscription,
  checkout,
  requestAccountDeletion,
  deleteOwnAccount,
  type UserResponse,
} from "@/api";
import { useAuth } from "@/auth";

interface SettingsPageProps {
  user: UserResponse;
}

export default function SettingsPage({ user }: SettingsPageProps) {
  const [comingSoon, setComingSoon] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletionRequested, setDeletionRequested] = useState(false);
  const { logout } = useAuth();

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
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {user.role === "child" && !deletionRequested && !showDeleteConfirm && (
            <Button
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
            >
              Request Account Deletion
            </Button>
          )}
          {user.role === "child" && showDeleteConfirm && (
            <div className="rounded border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950">
              <p className="text-sm">
                This action cannot be undone. Your parent will be asked to
                approve the deletion of your account and all your data.
              </p>
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={async () => {
                    await requestAccountDeletion();
                    setShowDeleteConfirm(false);
                    setDeletionRequested(true);
                  }}
                >
                  Confirm
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
          {user.role === "child" && deletionRequested && (
            <p className="text-sm text-muted-foreground">
              Your deletion request has been sent to your parent for approval.
            </p>
          )}
          {user.role === "parent" && !showDeleteConfirm && (
            <Button
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
            >
              Delete My Account
            </Button>
          )}
          {user.role === "parent" && showDeleteConfirm && (
            <div className="rounded border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950">
              <p className="text-sm">
                This action cannot be undone. Your account and all your data
                will be permanently deleted.
              </p>
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={async () => {
                    await deleteOwnAccount();
                    logout();
                  }}
                >
                  Confirm
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

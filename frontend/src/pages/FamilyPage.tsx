import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLoading } from "@/hooks/useLoading";
import {
  getFamily,
  createFamily,
  joinFamily,
  removeFamilyMember,
  deleteChildAccount,
  getDeletionRequests,
  approveDeletionRequest,
  type UserResponse,
  type FamilyCreateResponse,
  ApiError,
} from "@/api";
import { useState } from "react";

interface FamilyPageProps {
  user: UserResponse;
}

export default function FamilyPage({ user }: FamilyPageProps) {
  const queryClient = useQueryClient();
  const [createdFamily, setCreatedFamily] =
    useState<FamilyCreateResponse | null>(null);
  const [pin, setPin] = useState("");
  const [joinError, setJoinError] = useState("");
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [copied, setCopied] = useState(false);

  const { isLoading: isJoining, error: joinLoadingError, execute: executeJoin } = useLoading();

  const [deletingChildId, setDeletingChildId] = useState<number | null>(null);
  const [approvingRequestId, setApprovingRequestId] = useState<number | null>(null);

  const {
    data: family,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["family"],
    queryFn: getFamily,
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: createFamily,
    onSuccess: (data) => {
      setCreatedFamily(data);
      queryClient.invalidateQueries({ queryKey: ["family"] });
    },
  });

  const joinMutation = useMutation({
    mutationFn: joinFamily,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["family"] });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 403) {
        setShowUpgrade(true);
      } else if (err instanceof ApiError) {
        setJoinError(err.message);
      } else {
        setJoinError("Failed to join family");
      }
    },
  });

  const removeMutation = useMutation({
    mutationFn: removeFamilyMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["family"] });
    },
  });

  const deleteChildMutation = useMutation({
    mutationFn: deleteChildAccount,
    onSuccess: () => {
      setDeletingChildId(null);
      queryClient.invalidateQueries({ queryKey: ["family"] });
      queryClient.invalidateQueries({ queryKey: ["deletion-requests"] });
    },
  });

  const { data: deletionRequests } = useQuery({
    queryKey: ["deletion-requests"],
    queryFn: getDeletionRequests,
    retry: false,
    enabled: user.role === "parent",
  });

  const approveMutation = useMutation({
    mutationFn: approveDeletionRequest,
    onSuccess: () => {
      setApprovingRequestId(null);
      queryClient.invalidateQueries({ queryKey: ["family"] });
      queryClient.invalidateQueries({ queryKey: ["deletion-requests"] });
    },
  });

  if (isLoading) return <div>Loading...</div>;

  const hasNoFamily = error instanceof ApiError && error.status === 404;

  if (hasNoFamily && user.role === "child") {
    if (showUpgrade) {
      return (
        <div className="flex justify-center pt-12">
          <Card className="w-full max-w-md border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
            <CardHeader>
              <CardTitle>Family is Full</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-muted-foreground">
                This family has reached the free tier limit. Ask your parent to
                upgrade to SizePass to add more members.
              </p>
              <Link to="/sizepass">
                <Button variant="default">Upgrade</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="flex justify-center pt-12">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Join Family</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-muted-foreground">
              Enter the PIN from your parent to join a family.
            </p>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                setJoinError("");
                executeJoin(async () => {
                  try {
                    await joinMutation.mutateAsync(pin);
                  } catch (err) {
                    if (err instanceof ApiError && err.status === 403) {
                      setShowUpgrade(true);
                      return;
                    }
                    throw err;
                  }
                }).catch(() => {});
              }}
            >
              <div>
                <Label htmlFor="pin">PIN</Label>
                <Input
                  id="pin"
                  placeholder="Enter family PIN"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                />
              </div>
              {(joinError || joinLoadingError) && (
                <p className="text-sm text-destructive">{joinError || joinLoadingError}</p>
              )}
              <Button type="submit" disabled={isJoining}>
                {isJoining ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Joining...
                  </span>
                ) : (
                  "Join Family"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (hasNoFamily && user.role === "parent") {
    if (createdFamily) {
      return (
        <div className="flex justify-center pt-12">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Family Created!</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-2 text-muted-foreground">
                Share this PIN with your family members:
              </p>
              <p className="text-2xl font-bold tracking-widest">
                {createdFamily.pin}
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="flex justify-center pt-12">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Family</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-muted-foreground">
              You don't have a family yet. Create one to get started.
            </p>
            <Button onClick={() => createMutation.mutate()}>
              Create Family
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (family) {
    return (
      <div className="flex justify-center pt-12">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Family</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Family PIN</p>
                <p className="text-xl font-bold tracking-widest">
                  {family.pin}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(family.pin);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Members</p>
              <ul className="space-y-2">
                {family.members.map((member) => (
                  <li
                    key={member.id}
                    className="flex items-center justify-between rounded border p-2"
                  >
                    <div className="flex flex-col">
                      <span>{member.email}</span>
                      <span className="text-sm text-muted-foreground">
                        {member.role}
                      </span>
                    </div>
                    {user.role === "parent" && member.role === "child" && (
                      <div className="flex gap-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => removeMutation.mutate(member.id)}
                        >
                          Remove
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeletingChildId(member.id)}
                        >
                          Delete Account
                        </Button>
                      </div>
                    )}
                    {deletingChildId === member.id && (
                      <div className="mt-2 rounded border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950">
                        <p className="text-sm">
                          This will permanently delete this child's account and
                          all their data. This action cannot be undone.
                        </p>
                        <div className="mt-2 flex gap-2">
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() =>
                              deleteChildMutation.mutate(member.id)
                            }
                          >
                            Confirm
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setDeletingChildId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            {user.role === "parent" &&
              deletionRequests &&
              deletionRequests.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium">Deletion Requests</p>
                  <ul className="space-y-2">
                    {deletionRequests.map((req) => {
                      const child = family.members.find(
                        (m) => m.id === req.child_id,
                      );
                      return (
                        <li
                          key={req.id}
                          className="rounded border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm">
                              {child?.email ?? `Child #${req.child_id}`}{" "}
                              requested account deletion
                            </span>
                            {approvingRequestId !== req.id && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() =>
                                  setApprovingRequestId(req.id)
                                }
                              >
                                Approve
                              </Button>
                            )}
                          </div>
                          {approvingRequestId === req.id && (
                            <div className="mt-2 rounded border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950">
                              <p className="text-sm">
                                This will permanently delete this child's
                                account and all their data. This action cannot
                                be undone.
                              </p>
                              <div className="mt-2 flex gap-2">
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() =>
                                    approveMutation.mutate(req.id)
                                  }
                                >
                                  Confirm
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    setApprovingRequestId(null)
                                  }
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return <div>Family</div>;
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getFamily,
  createFamily,
  joinFamily,
  removeFamilyMember,
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
      if (err instanceof ApiError) {
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

  if (isLoading) return <div>Loading...</div>;

  const hasNoFamily = error instanceof ApiError && error.status === 404;

  if (hasNoFamily && user.role === "child") {
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
                joinMutation.mutate(pin);
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
              {joinError && (
                <p className="text-sm text-destructive">{joinError}</p>
              )}
              <Button type="submit">Join Family</Button>
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
                onClick={() => navigator.clipboard.writeText(family.pin)}
              >
                Copy
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
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => removeMutation.mutate(member.id)}
                      >
                        Remove
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <div>Family</div>;
}

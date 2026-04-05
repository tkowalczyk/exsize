import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Avatar from "@/components/Avatar";
import { getProfile, getChildProfile, getEquippedAvatar, setNickname, type UserResponse, type ProfileResponse } from "@/api";

interface ProfilePageProps {
  user: UserResponse;
}

export default function ProfilePage({ user }: ProfilePageProps) {
  const { childId } = useParams<{ childId: string }>();
  const childIdNum = childId ? Number(childId) : undefined;

  const { data: profile } = useQuery({
    queryKey: childIdNum ? ["child-profile", childIdNum] : ["profile"],
    queryFn: () => (childIdNum ? getChildProfile(childIdNum) : getProfile()),
    retry: false,
    enabled: user.role === "child" || (user.role === "parent" && childIdNum != null),
  });

  if (user.role === "parent" && childIdNum == null) {
    return <p>Select a child to view their profile.</p>;
  }

  if (user.role !== "child" && user.role !== "parent") {
    return <p>Profiles are for children only.</p>;
  }

  const avatarUserId = childIdNum ?? user.id;
  const { data: avatarData } = useQuery({
    queryKey: ["equipped-avatar", avatarUserId],
    queryFn: () => getEquippedAvatar(avatarUserId),
    retry: false,
    enabled: profile != null,
  });

  if (!profile) return null;

  const isOwnProfile = user.role === "child" && childIdNum == null;

  return <ProfileView profile={profile} avatarIcon={avatarData?.icon?.value} avatarBackground={avatarData?.background?.value} canEdit={isOwnProfile} nicknameChanges={profile.nickname_changes} />;
}

function NicknameForm({ currentNickname, nicknameChanges }: { currentNickname: string | null; nicknameChanges: number }) {
  const [nickname, setNicknameValue] = useState(currentNickname ?? "");
  const [showConfirm, setShowConfirm] = useState(false);
  const queryClient = useQueryClient();
  const willCost = nicknameChanges > 0;

  const mutation = useMutation({
    mutationFn: (nick: string) => setNickname(nick),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["exbucks-balance"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      setShowConfirm(false);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nickname.trim()) return;
    if (willCost) {
      setShowConfirm(true);
    } else {
      mutation.mutate(nickname.trim());
    }
  }

  return (
    <div className="space-y-2">
      <form className="flex items-end gap-2" onSubmit={handleSubmit}>
        <div className="flex-1">
          <Label htmlFor="nickname">Nickname</Label>
          <Input
            id="nickname"
            value={nickname}
            onChange={(e) => setNicknameValue(e.target.value)}
          />
        </div>
        <Button type="submit">Save Nickname</Button>
      </form>
      {willCost && !showConfirm && (
        <p className="text-xs text-muted-foreground">Changing nickname costs 50 ExBucks.</p>
      )}
      {showConfirm && (
        <div className="rounded border border-yellow-300 bg-yellow-50 p-3 dark:border-yellow-600 dark:bg-yellow-950">
          <p className="text-sm font-medium">Are you sure? This will cost 50 ExBucks.</p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={() => mutation.mutate(nickname.trim())}>
              Confirm
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowConfirm(false)}>
              Cancel
            </Button>
          </div>
          {mutation.isError && (
            <p className="mt-2 text-xs text-red-600">{(mutation.error as Error).message}</p>
          )}
        </div>
      )}
    </div>
  );
}

function ProfileView({ profile, avatarIcon, avatarBackground, canEdit, nicknameChanges }: { profile: ProfileResponse; avatarIcon?: string | null; avatarBackground?: string | null; canEdit: boolean; nicknameChanges: number }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar icon={avatarIcon} background={avatarBackground} size="lg" />
            <div>
              {profile.nickname && <p className="text-lg font-semibold">{profile.nickname}</p>}
              <CardTitle>Level {profile.level}</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-lg font-semibold">{profile.level_name}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {profile.xp} XP &middot; {profile.xp_for_next_level} XP to next level
          </p>
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span>{profile.progress_percent}%</span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={profile.progress_percent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-3 w-full overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${profile.progress_percent}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle>Nickname</CardTitle>
          </CardHeader>
          <CardContent>
            <NicknameForm currentNickname={profile.nickname} nicknameChanges={nicknameChanges} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Streak</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">
            {profile.streak} day streak
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Badges</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-4">
            {profile.badges.map((badge) => (
              <div
                key={badge}
                className="flex flex-col items-center gap-1 rounded-lg border border-primary bg-primary/10 p-3 text-center"
              >
                <span className="text-xs font-medium">{badge}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}

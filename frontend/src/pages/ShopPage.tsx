import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Avatar from "@/components/Avatar";
import {
  getRewards,
  getBalance,
  getPurchases,
  purchaseReward,
  getFamily,
  getChildPurchases,
  getAvatarShop,
  getAvatarInventory,
  getEquippedAvatar,
  purchaseAvatarItem,
  equipAvatarItem,
  unequipAvatarItem,
  type UserResponse,
  type PurchaseResponse,
  type AvatarItemResponse,
} from "@/api";

interface ShopPageProps {
  user: UserResponse;
}

function PurchaseList({ purchases }: { purchases: PurchaseResponse[] }) {
  return (
    <div className="space-y-2">
      {purchases.map((p) => (
        <div key={p.id} className="flex items-center justify-between rounded border p-3">
          <span className="font-medium">{p.reward_name}</span>
          <div className="flex items-center gap-4">
            <span className="font-semibold">{p.price} ExBucks</span>
            <span className="text-sm text-muted-foreground">
              {new Date(p.created_at).toLocaleString()}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function AvatarShopSection({ user }: { user: UserResponse }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"shop" | "inventory">("shop");
  const [error, setError] = useState("");

  const { data: shopItems } = useQuery({
    queryKey: ["avatar-shop"],
    queryFn: getAvatarShop,
    retry: false,
  });

  const { data: inventory } = useQuery({
    queryKey: ["avatar-inventory"],
    queryFn: getAvatarInventory,
    retry: false,
  });

  const { data: equipped } = useQuery({
    queryKey: ["equipped-avatar", user.id],
    queryFn: () => getEquippedAvatar(user.id),
    retry: false,
  });

  const { data: balanceData } = useQuery({
    queryKey: ["exbucks-balance"],
    queryFn: getBalance,
    retry: false,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["avatar-inventory"] });
    queryClient.invalidateQueries({ queryKey: ["avatar-shop"] });
    queryClient.invalidateQueries({ queryKey: ["equipped-avatar"] });
    queryClient.invalidateQueries({ queryKey: ["exbucks-balance"] });
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    setError("");
  };

  const purchaseMutation = useMutation({
    mutationFn: purchaseAvatarItem,
    onSuccess: invalidateAll,
    onError: (err: Error) => setError(err.message),
  });

  const equipMutation = useMutation({
    mutationFn: equipAvatarItem,
    onSuccess: invalidateAll,
    onError: (err: Error) => setError(err.message),
  });

  const unequipMutation = useMutation({
    mutationFn: unequipAvatarItem,
    onSuccess: invalidateAll,
    onError: (err: Error) => setError(err.message),
  });

  const balance = balanceData?.balance ?? 0;
  const ownedIds = new Set(inventory?.map((i) => i.id) ?? []);
  const equippedIconId = equipped?.icon?.id;
  const equippedBgId = equipped?.background?.id;

  const shopIcons = shopItems?.filter((i) => i.type === "icon") ?? [];
  const shopBackgrounds = shopItems?.filter((i) => i.type === "background") ?? [];
  const invIcons = inventory?.filter((i) => i.type === "icon") ?? [];
  const invBackgrounds = inventory?.filter((i) => i.type === "background") ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Avatars</CardTitle>
          <div className="flex items-center gap-3">
            <Avatar
              icon={equipped?.icon?.value}
              background={equipped?.background?.value}
              size="md"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          <Button
            variant={tab === "shop" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("shop")}
          >
            Shop
          </Button>
          <Button
            variant={tab === "inventory" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("inventory")}
          >
            My Items
          </Button>
        </div>

        {tab === "shop" && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground">Icons</h3>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {shopIcons.map((item) => (
                <AvatarShopCard
                  key={item.id}
                  item={item}
                  owned={ownedIds.has(item.id)}
                  balance={balance}
                  onBuy={() => purchaseMutation.mutate(item.id)}
                />
              ))}
            </div>
            <h3 className="text-sm font-semibold text-muted-foreground">Backgrounds</h3>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {shopBackgrounds.map((item) => (
                <AvatarShopCard
                  key={item.id}
                  item={item}
                  owned={ownedIds.has(item.id)}
                  balance={balance}
                  onBuy={() => purchaseMutation.mutate(item.id)}
                />
              ))}
            </div>
          </div>
        )}

        {tab === "inventory" && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground">Icons</h3>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {invIcons.map((item) => (
                <AvatarInventoryCard
                  key={item.id}
                  item={item}
                  isEquipped={item.id === equippedIconId}
                  onEquip={() => equipMutation.mutate(item.id)}
                  onUnequip={() => unequipMutation.mutate("icon")}
                />
              ))}
            </div>
            <h3 className="text-sm font-semibold text-muted-foreground">Backgrounds</h3>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {invBackgrounds.map((item) => (
                <AvatarInventoryCard
                  key={item.id}
                  item={item}
                  isEquipped={item.id === equippedBgId}
                  onEquip={() => equipMutation.mutate(item.id)}
                  onUnequip={() => unequipMutation.mutate("background")}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AvatarShopCard({
  item,
  owned,
  balance,
  onBuy,
}: {
  item: AvatarItemResponse;
  owned: boolean;
  balance: number;
  onBuy: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border p-3 text-center">
      {item.type === "icon" ? (
        <Avatar icon={item.value} size="md" />
      ) : (
        <Avatar background={item.value} size="md" />
      )}
      <span className="text-xs font-medium">{item.label}</span>
      {owned ? (
        <span className="text-xs text-green-600">Owned</span>
      ) : (
        <>
          <span className="text-xs text-muted-foreground">{item.price} EB</span>
          <Button
            size="sm"
            className="mt-1 h-6 text-xs"
            disabled={balance < item.price}
            onClick={onBuy}
          >
            Buy
          </Button>
        </>
      )}
    </div>
  );
}

function AvatarInventoryCard({
  item,
  isEquipped,
  onEquip,
  onUnequip,
}: {
  item: AvatarItemResponse;
  isEquipped: boolean;
  onEquip: () => void;
  onUnequip: () => void;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-center ${
        isEquipped ? "border-primary bg-primary/10" : ""
      }`}
    >
      {item.type === "icon" ? (
        <Avatar icon={item.value} size="md" />
      ) : (
        <Avatar background={item.value} size="md" />
      )}
      <span className="text-xs font-medium">{item.label}</span>
      {isEquipped ? (
        <Button
          variant="outline"
          size="sm"
          className="mt-1 h-6 text-xs"
          onClick={onUnequip}
        >
          Unequip
        </Button>
      ) : (
        <Button
          size="sm"
          className="mt-1 h-6 text-xs"
          onClick={onEquip}
        >
          Equip
        </Button>
      )}
    </div>
  );
}

export default function ShopPage({ user }: ShopPageProps) {
  const queryClient = useQueryClient();
  const isChild = user.role === "child";
  const isParent = user.role === "parent";
  const [selectedChildId, setSelectedChildId] = useState("");
  const [purchaseError, setPurchaseError] = useState("");

  const { data: rewards, isLoading } = useQuery({
    queryKey: ["rewards"],
    queryFn: getRewards,
    retry: false,
  });

  const { data: balanceData } = useQuery({
    queryKey: ["exbucks-balance"],
    queryFn: getBalance,
    retry: false,
    enabled: isChild,
  });

  const { data: purchases } = useQuery({
    queryKey: ["purchases"],
    queryFn: getPurchases,
    retry: false,
    enabled: isChild,
  });

  const { data: family } = useQuery({
    queryKey: ["family"],
    queryFn: getFamily,
    retry: false,
    enabled: isParent,
  });

  const { data: childPurchases } = useQuery({
    queryKey: ["child-purchases", selectedChildId],
    queryFn: () => getChildPurchases(Number(selectedChildId)),
    retry: false,
    enabled: isParent && selectedChildId !== "",
  });

  const purchaseMutation = useMutation({
    mutationFn: purchaseReward,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exbucks-balance"] });
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      setPurchaseError("");
    },
    onError: (error: Error) => {
      setPurchaseError(error.message);
    },
  });

  const balance = balanceData?.balance ?? 0;
  const children = family?.members.filter((m) => m.role === "child") ?? [];

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Shop</h1>

      {isChild && (
        <>
          <AvatarShopSection user={user} />

          <Card>
            <CardHeader>
              <CardTitle>Reward Catalog</CardTitle>
            </CardHeader>
            <CardContent>
              {purchaseError && (
                <p className="mb-4 text-sm text-red-600">{purchaseError}</p>
              )}
              {!rewards || rewards.length === 0 ? (
                <p className="text-muted-foreground">No rewards available.</p>
              ) : (
                <div className="space-y-2">
                  {rewards.map((reward) => (
                    <div
                      key={reward.id}
                      className="flex items-center justify-between rounded border p-3"
                    >
                      <div>
                        <span className="font-medium">{reward.name}</span>
                        <span className="ml-2 text-sm text-muted-foreground">
                          {reward.description}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{reward.price} ExBucks</span>
                        <Button
                          size="sm"
                          disabled={balance < reward.price}
                          onClick={() => purchaseMutation.mutate(reward.id)}
                        >
                          Buy
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Purchase History</CardTitle>
            </CardHeader>
            <CardContent>
              {!purchases || purchases.length === 0 ? (
                <p className="text-muted-foreground">No purchases yet.</p>
              ) : (
                <PurchaseList purchases={purchases} />
              )}
            </CardContent>
          </Card>
        </>
      )}

      {isParent && (
        <Card>
          <CardHeader>
            <CardTitle>Children's Purchases</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label htmlFor="child-purchase-select" className="text-sm font-medium">
                Select Child
              </label>
              <select
                id="child-purchase-select"
                className="w-full rounded border p-2"
                value={selectedChildId}
                onChange={(e) => setSelectedChildId(e.target.value)}
              >
                <option value="">Select child</option>
                {children.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.email}
                  </option>
                ))}
              </select>
            </div>
            {childPurchases && (
              childPurchases.length === 0 ? (
                <p className="text-muted-foreground">No purchases yet.</p>
              ) : (
                <PurchaseList purchases={childPurchases} />
              )
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

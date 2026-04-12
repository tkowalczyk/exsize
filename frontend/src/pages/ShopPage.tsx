import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Avatar from "@/components/Avatar";
import {
  getBalance,
  getAvatarShop,
  getAvatarInventory,
  getEquippedAvatar,
  purchaseAvatarItem,
  equipAvatarItem,
  unequipAvatarItem,
  type UserResponse,
  type AvatarItemResponse,
} from "@/api";

interface ShopPageProps {
  user: UserResponse;
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
                  isPurchasing={purchaseMutation.isPending}
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
                  isPurchasing={purchaseMutation.isPending}
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
                  isEquipping={equipMutation.isPending}
                  isUnequipping={unequipMutation.isPending}
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
                  isEquipping={equipMutation.isPending}
                  isUnequipping={unequipMutation.isPending}
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
  isPurchasing,
  onBuy,
}: {
  item: AvatarItemResponse;
  owned: boolean;
  balance: number;
  isPurchasing: boolean;
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
            disabled={balance < item.price || isPurchasing}
            onClick={onBuy}
          >
            {isPurchasing ? (
              <span className="flex items-center gap-1">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Buying...
              </span>
            ) : (
              "Buy"
            )}
          </Button>
        </>
      )}
    </div>
  );
}

function AvatarInventoryCard({
  item,
  isEquipped,
  isEquipping,
  isUnequipping,
  onEquip,
  onUnequip,
}: {
  item: AvatarItemResponse;
  isEquipped: boolean;
  isEquipping: boolean;
  isUnequipping: boolean;
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
          disabled={isUnequipping}
          onClick={onUnequip}
        >
          {isUnequipping ? (
            <span className="flex items-center gap-1">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Unequipping...
            </span>
          ) : (
            "Unequip"
          )}
        </Button>
      ) : (
        <Button
          size="sm"
          className="mt-1 h-6 text-xs"
          disabled={isEquipping}
          onClick={onEquip}
        >
          {isEquipping ? (
            <span className="flex items-center gap-1">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Equipping...
            </span>
          ) : (
            "Equip"
          )}
        </Button>
      )}
    </div>
  );
}

export default function ShopPage({ user }: ShopPageProps) {
  const isChild = user.role === "child";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Shop</h1>

      {isChild && <AvatarShopSection user={user} />}
    </div>
  );
}

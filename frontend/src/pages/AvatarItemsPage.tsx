import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Avatar from "@/components/Avatar";
import {
  getAvatarItems,
  createAvatarItem,
  updateAvatarItem,
  deleteAvatarItem,
  type UserResponse,
  type AvatarItemResponse,
} from "@/api";

interface AvatarItemsPageProps {
  user: UserResponse;
}

function ItemRow({
  item,
  onEdit,
  onDelete,
}: {
  item: AvatarItemResponse;
  onEdit: (item: AvatarItemResponse) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between" data-testid="avatar-item-row">
      <div className="flex items-center gap-3">
        {item.type === "icon" ? (
          <Avatar icon={item.value} size="sm" />
        ) : (
          <Avatar background={item.value} size="sm" />
        )}
        <div>
          <p className="font-medium">
            {item.label}
            {item.is_default && (
              <span className="ml-2 text-xs text-muted-foreground">(default)</span>
            )}
          </p>
          <p className="text-sm text-muted-foreground">
            {item.type} · {item.price} ExBucks
            {!item.active_in_shop && (
              <span className="ml-1 text-red-500">(removed)</span>
            )}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="min-h-[44px] sm:min-h-0" onClick={() => onEdit(item)}>
          Edit
        </Button>
        {item.active_in_shop && (
          <Button variant="destructive" size="sm" className="min-h-[44px] sm:min-h-0" onClick={() => onDelete(item.id)}>
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}

export default function AvatarItemsPage({ user }: AvatarItemsPageProps) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<AvatarItemResponse | null>(null);
  const [type, setType] = useState<"icon" | "background">("icon");
  const [value, setValue] = useState("");
  const [label, setLabel] = useState("");
  const [price, setPrice] = useState("");
  const [activeInShop, setActiveInShop] = useState(true);

  const { data: items, isLoading } = useQuery({
    queryKey: ["avatar-items"],
    queryFn: getAvatarItems,
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: createAvatarItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["avatar-items"] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof updateAvatarItem>[1] }) =>
      updateAvatarItem(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["avatar-items"] });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAvatarItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["avatar-items"] });
    },
  });

  function resetForm() {
    setShowForm(false);
    setEditingItem(null);
    setType("icon");
    setValue("");
    setLabel("");
    setPrice("");
    setActiveInShop(true);
  }

  function startEdit(item: AvatarItemResponse) {
    setEditingItem(item);
    setShowForm(true);
    setType(item.type);
    setValue(item.value);
    setLabel(item.label);
    setPrice(String(item.price));
    setActiveInShop(item.active_in_shop);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingItem) {
      updateMutation.mutate({
        id: editingItem.id,
        data: { label, price: Number(price), active_in_shop: activeInShop },
      });
    } else {
      createMutation.mutate({ type, value, label, price: Number(price) });
    }
  }

  if (user.role !== "admin") return <p>Admin only.</p>;
  if (isLoading) return <div>Loading...</div>;

  const icons = items?.filter((i) => i.type === "icon") ?? [];
  const backgrounds = items?.filter((i) => i.type === "background") ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" data-testid="avatar-items-header">
        <h1 className="text-2xl font-bold">Avatar Items</h1>
        <Button className="min-h-[44px] sm:min-h-0" onClick={() => { resetForm(); setShowForm(true); }}>
          Add Item
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingItem ? "Edit Item" : "New Item"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              {!editingItem && (
                <>
                  <div>
                    <Label>Type</Label>
                    <select
                      className="mt-1 w-full rounded border bg-background px-3 py-2"
                      value={type}
                      onChange={(e) => setType(e.target.value as "icon" | "background")}
                    >
                      <option value="icon">Icon</option>
                      <option value="background">Background</option>
                    </select>
                  </div>
                  <div>
                    <Label>Value</Label>
                    <Input
                      placeholder={type === "icon" ? "Emoji e.g. 🐱" : "Color e.g. #FF5733"}
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      required
                    />
                  </div>
                </>
              )}
              <div>
                <Label>Label</Label>
                <Input value={label} onChange={(e) => setLabel(e.target.value)} required />
              </div>
              <div>
                <Label>Price (ExBucks)</Label>
                <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} required />
              </div>
              {editingItem && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="active-in-shop"
                    checked={activeInShop}
                    onChange={(e) => setActiveInShop(e.target.checked)}
                  />
                  <Label htmlFor="active-in-shop">Active in shop</Label>
                </div>
              )}
              <div className="flex gap-2">
                <Button type="submit">
                  {editingItem ? "Save" : "Create"}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Icons ({icons.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {icons.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              onEdit={startEdit}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Backgrounds ({backgrounds.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {backgrounds.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              onEdit={startEdit}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

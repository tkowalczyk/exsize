import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getTransactions,
  getChildTransactions,
  getFamily,
  assignPenalty,
  type UserResponse,
  type TransactionResponse,
} from "@/api";

interface ExBucksPageProps {
  user: UserResponse;
}

const typeStyles: Record<string, string> = {
  earned: "text-green-600",
  spent: "text-blue-600",
  penalized: "text-red-600",
};

function formatAmount(amount: number) {
  return amount > 0 ? `+${amount}` : `${amount}`;
}

function TransactionList({ transactions }: { transactions: TransactionResponse[] }) {
  return (
    <div className="space-y-2">
      {transactions.map((txn) => (
        <div
          key={txn.id}
          data-testid="transaction-item"
          className="flex flex-col gap-1 rounded border p-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <span className="font-medium">{txn.description}</span>
            <span
              className={`ml-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${typeStyles[txn.type] ?? ""}`}
            >
              {txn.type}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className={`font-semibold ${typeStyles[txn.type] ?? ""}`}>
              {formatAmount(txn.amount)}
            </span>
            <span className="text-sm text-muted-foreground">
              {new Date(txn.created_at).toLocaleString()}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ExBucksPage({ user }: ExBucksPageProps) {
  const queryClient = useQueryClient();
  const isChild = user.role === "child";
  const isParent = user.role === "parent";
  const [selectedChildId, setSelectedChildId] = useState("");
  const [penaltyChildId, setPenaltyChildId] = useState("");
  const [penaltyAmount, setPenaltyAmount] = useState("");
  const [penaltyReason, setPenaltyReason] = useState("");

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["transactions"],
    queryFn: getTransactions,
    retry: false,
    enabled: isChild,
  });

  const { data: family } = useQuery({
    queryKey: ["family"],
    queryFn: getFamily,
    retry: false,
    enabled: isParent,
  });

  const { data: childTransactions } = useQuery({
    queryKey: ["child-transactions", selectedChildId],
    queryFn: () => getChildTransactions(Number(selectedChildId)),
    retry: false,
    enabled: isParent && selectedChildId !== "",
  });

  const penaltyMutation = useMutation({
    mutationFn: assignPenalty,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["child-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["exbucks-balance"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      setPenaltyChildId("");
      setPenaltyAmount("");
      setPenaltyReason("");
    },
    onError: () => {},
  });

  const children = family?.members.filter((m) => m.role === "child") ?? [];

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">ExBucks</h1>

      {isChild && transactions && (
        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <p className="text-muted-foreground">No transactions yet.</p>
            ) : (
              <TransactionList transactions={transactions} />
            )}
          </CardContent>
        </Card>
      )}

      {isParent && (
        <Card>
          <CardHeader>
            <CardTitle>Child Transactions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="child-select">Select Child</Label>
              <select
                id="child-select"
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
            {childTransactions && (
              childTransactions.length === 0 ? (
                <p className="text-muted-foreground">No transactions yet.</p>
              ) : (
                <TransactionList transactions={childTransactions} />
              )
            )}
          </CardContent>
        </Card>
      )}

      {isParent && (
        <Card>
          <CardHeader>
            <CardTitle>Assign Penalty</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                penaltyMutation.mutate({
                  child_id: Number(penaltyChildId),
                  amount: Number(penaltyAmount),
                  reason: penaltyReason,
                });
              }}
            >
              <div>
                <Label htmlFor="penalty-child">Penalty Child</Label>
                <select
                  id="penalty-child"
                  className="w-full rounded border p-2"
                  value={penaltyChildId}
                  onChange={(e) => setPenaltyChildId(e.target.value)}
                >
                  <option value="">Select child</option>
                  {children.map((child) => (
                    <option key={child.id} value={child.id}>
                      {child.email}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="penalty-amount">Amount</Label>
                <Input
                  id="penalty-amount"
                  type="number"
                  value={penaltyAmount}
                  onChange={(e) => setPenaltyAmount(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="penalty-reason">Reason</Label>
                <Input
                  id="penalty-reason"
                  value={penaltyReason}
                  onChange={(e) => setPenaltyReason(e.target.value)}
                />
              </div>
              <Button type="submit" className="min-h-[44px] sm:min-h-0" disabled={penaltyMutation.isPending}>
                {penaltyMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Assigning...
                  </span>
                ) : (
                  "Assign Penalty"
                )}
              </Button>
              {penaltyMutation.isError && (
                <p className="text-sm text-destructive">{(penaltyMutation.error as Error)?.message}</p>
              )}
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

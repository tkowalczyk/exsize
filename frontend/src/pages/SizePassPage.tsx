import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  checkout,
  cancelSubscription,
  getSubscription,
  type UserResponse,
} from "@/api";

const BENEFITS = [
  "Family leaderboard",
  "Photos on tasks",
  "Unlimited family size",
  "Advanced dashboard stats",
  "SizePass badges",
];

const PLANS = [
  { id: "monthly" as const, label: "Monthly", price: "XXXXX" },
  { id: "yearly" as const, label: "Yearly", price: "XXXXX" },
];

type Step = "pricing" | "summary" | "paying" | "success";

interface SizePassPageProps {
  user: UserResponse;
}

export default function SizePassPage({ user }: SizePassPageProps) {
  const queryClient = useQueryClient();
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly" | null>(null);
  const [step, setStep] = useState<Step>("pricing");
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const { data: subscription } = useQuery({
    queryKey: ["subscription"],
    queryFn: getSubscription,
    retry: false,
  });

  const isActive = subscription && subscription.status === "active";
  const isParent = user.role === "parent" || user.role === "admin";

  async function handlePay() {
    if (!selectedPlan) return;
    setStep("paying");
    setError(null);
    try {
      await new Promise((r) => setTimeout(r, 2500));
      await checkout(selectedPlan);
      setStep("success");
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
    } catch (e: unknown) {
      setStep("summary");
      setError(e instanceof Error ? e.message : "Checkout failed");
    }
  }

  async function handleCancel() {
    setCancelling(true);
    try {
      await cancelSubscription();
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setCancelling(false);
    }
  }

  if (step === "success") {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <div className="text-6xl">🎉</div>
        <h1 className="text-3xl font-bold">Welcome to SizePass!</h1>
        <p className="text-muted-foreground">
          Your family now has access to all premium features.
        </p>
      </div>
    );
  }

  if (step === "paying") {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-lg text-muted-foreground">Processing payment...</p>
      </div>
    );
  }

  if (step === "summary" && selectedPlan) {
    const plan = PLANS.find((p) => p.id === selectedPlan)!;
    return (
      <div className="mx-auto max-w-md space-y-6 py-6">
        <h1 className="text-2xl font-bold">Order Summary</h1>
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="flex justify-between">
              <span className="font-medium">SizePass — {plan.label}</span>
              <span className="font-bold">{plan.price} USD</span>
            </div>
            <hr />
            <div className="flex justify-between text-lg font-bold">
              <span>Total</span>
              <span>{plan.price} USD</span>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <Button className="flex-1" onClick={handlePay}>
                Pay
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setStep("pricing");
                  setError(null);
                }}
              >
                Back
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">SizePass</h1>

      {isActive && (
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between" data-testid="sizepass-active-card">
            <div>
              <p className="text-lg font-semibold">
                SizePass Active — {subscription.plan}
              </p>
              <p className="text-sm text-muted-foreground">
                Your family has access to all premium features.
              </p>
            </div>
            {isParent && (
              <Button
                variant="destructive"
                className="min-h-[44px] sm:min-h-0"
                disabled={cancelling}
                onClick={handleCancel}
              >
                {cancelling ? "Cancelling..." : "Cancel Subscription"}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!isActive && (
        <>
          <div className="grid gap-6 md:grid-cols-2" data-testid="plans-grid">
            {PLANS.map((plan) => (
              <Card
                key={plan.id}
                className={
                  selectedPlan === plan.id
                    ? "ring-2 ring-primary"
                    : ""
                }
              >
                <CardHeader>
                  <CardTitle>{plan.label}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-3xl font-bold">{plan.price} USD</p>
                  <ul className="space-y-2">
                    {BENEFITS.map((b) => (
                      <li key={b} className="flex items-center gap-2 text-sm">
                        <span className="text-green-600">&#10003;</span> {b}
                      </li>
                    ))}
                  </ul>
                  {isParent ? (
                    <Button
                      className="w-full"
                      variant={selectedPlan === plan.id ? "default" : "outline"}
                      onClick={() => {
                        setSelectedPlan(plan.id);
                        setStep("summary");
                      }}
                    >
                      Buy
                    </Button>
                  ) : (
                    <Button className="w-full" disabled>
                      Ask your parent to upgrade
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

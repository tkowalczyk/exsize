import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { login as apiLogin, adminLogin as apiAdminLogin } from "@/api";
import { useAuth } from "@/auth";
import { useLoading } from "@/hooks/useLoading";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminSecret, setAdminSecret] = useState("");
  const { isLoading, error, execute } = useLoading();
  const { handleLogin } = useAuth();
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    execute(async () => {
      const { access_token } = isAdmin
        ? await apiAdminLogin(adminSecret)
        : await apiLogin(email, password);
      const user = await handleLogin(access_token);
      navigate(user.role === "child" ? "/tasks" : "/dashboard", {
        replace: true,
      });
    }).catch(() => {
      // useLoading captures the error; swallow to avoid unhandled rejection
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Login</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            {!isAdmin && (
              <>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </>
            )}
            {isAdmin && (
              <div>
                <Label htmlFor="admin-secret">Admin Secret</Label>
                <Input
                  id="admin-secret"
                  type="password"
                  value={adminSecret}
                  onChange={(e) => setAdminSecret(e.target.value)}
                  required
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              <Checkbox
                id="admin-toggle"
                checked={isAdmin}
                onCheckedChange={(v) => setIsAdmin(v === true)}
              />
              <Label htmlFor="admin-toggle">Login as Admin</Label>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Logging in...
                </span>
              ) : (
                "Login"
              )}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link to="/register" className="text-primary underline">
              Register
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/auth";

export const Route = createFileRoute("/admin/login")({
  component: AdminLoginComponent,
});

function AdminLoginComponent() {
  const navigate = useNavigate();
  const { signIn, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    const { error, profile } = await signIn(email, password);

    if (error) {
      setIsLoading(false);
      toast.error(error);
      return;
    }

    if (!profile || profile.role !== "admin") {
      await signOut();
      setIsLoading(false);
      toast.error("Access denied. This login is for administrators only.");
      return;
    }

    setIsLoading(false);
    navigate({ to: "/admin" });
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-xl bg-card p-8 shadow-sm ring-1 ring-border/50">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-primary">
              <ShieldCheck className="size-6 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              Administrator Access
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in to access the admin dashboard
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Admin Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-10 rounded-lg bg-background px-3"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-10 rounded-lg bg-background px-3"
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="h-10 w-full rounded-lg text-sm font-semibold"
            >
              {isLoading ? "Logging in..." : "Log in"}
            </Button>
          </form>
        </div>

        <p className="mt-4 text-center text-sm">
          <Link
            to="/login"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Back to student login
          </Link>
        </p>
      </div>
    </div>
  );
}

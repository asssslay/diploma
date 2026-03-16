import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
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
    navigate({ to: "/" });
  }

  return (
    <div className="flex min-h-svh items-center justify-center">
      <div className="w-full max-w-sm px-4">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight">
            Administrator Access
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
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
              className="h-10 rounded-md px-3 text-sm"
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
              className="h-10 rounded-md px-3 text-sm"
            />
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="h-10 w-full rounded-md text-sm"
          >
            {isLoading ? "Logging in..." : "Log in"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm">
          <Link
            to="/login"
            className="text-muted-foreground hover:text-foreground"
          >
            ← Back to student login
          </Link>
        </p>
      </div>
    </div>
  );
}

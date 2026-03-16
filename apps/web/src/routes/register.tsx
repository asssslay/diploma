import { Link, createFileRoute } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/auth";

export const Route = createFileRoute("/register")({
  component: RegisterComponent,
});

function RegisterComponent() {
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [group, setGroup] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await signUp(email, password, {
      full_name: fullName,
      group,
    });

    setIsLoading(false);

    if (error) {
      toast.error(error);
      return;
    }

    toast.success(
      "Registration submitted. Your account is pending administrator approval.",
    );
  }

  return (
    <div className="flex min-h-svh items-center justify-center">
      <div className="w-full max-w-sm px-4">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight">
            Student Registration
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Apply for a student account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName" className="text-sm font-medium">
              Full name
            </Label>
            <Input
              id="fullName"
              type="text"
              placeholder="John Smith"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="h-10 rounded-md px-3 text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">
              University email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="student@university.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-10 rounded-md px-3 text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="group" className="text-sm font-medium">
              Faculty or group
            </Label>
            <Input
              id="group"
              type="text"
              placeholder="Computer Science"
              value={group}
              onChange={(e) => setGroup(e.target.value)}
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
              placeholder="Create your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="h-10 rounded-md px-3 text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox checked disabled />
            <span className="text-sm text-muted-foreground">
              Account approval required
            </span>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="h-10 w-full rounded-md text-sm"
          >
            {isLoading ? "Submitting..." : "Register"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-foreground underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}

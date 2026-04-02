import { Link, createFileRoute } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/auth";

export const Route = createFileRoute("/register")({
  component: RegisterComponent,
});

const ALLOWED_EMAIL_DOMAINS = [".edu", ".edu.ua", ".ac.uk"];
const ALLOWED_EMAILS = ["avramova.ruslana.a.r.r@gmail.com"];

const registerSchema = z.object({
  fullName: z.string().min(2, { message: "Name must be at least 2 characters" }),
  email: z
    .string()
    .email({ message: "Invalid email address" })
    .refine(
      (val) =>
        ALLOWED_EMAILS.includes(val) ||
        ALLOWED_EMAIL_DOMAINS.some((domain) => val.endsWith(domain)),
      { message: "Please use your university email address" },
    ),
  group: z.string().min(1, { message: "Faculty or group is required" }),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters" })
    .refine((val) => /[a-zA-Z]/.test(val) && /[0-9]/.test(val), {
      message: "Password must include both letters and numbers",
    }),
});

type FieldErrors = Partial<Record<keyof z.infer<typeof registerSchema>, string>>;

function RegisterComponent() {
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [group, setGroup] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const result = registerSchema.safeParse({ fullName, email, group, password });

    if (!result.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof FieldErrors;
        if (!fieldErrors[field]) {
          fieldErrors[field] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setIsLoading(true);

    const { error } = await signUp(result.data.email, result.data.password, {
      full_name: result.data.fullName,
      group: result.data.group,
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
              className="h-10 px-3 text-sm"
            />
            {errors.fullName && (
              <p className="text-sm text-destructive">{errors.fullName}</p>
            )}
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
              className="h-10 px-3 text-sm"
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email}</p>
            )}
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
              className="h-10 px-3 text-sm"
            />
            {errors.group && (
              <p className="text-sm text-destructive">{errors.group}</p>
            )}
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
              className="h-10 px-3 text-sm"
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password}</p>
            )}
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
            className="h-10 w-full text-sm"
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

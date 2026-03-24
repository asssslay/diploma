import { createFactory } from "hono/factory";

interface Profile {
  id: string;
  role: "admin" | "student";
  status: "pending" | "approved" | "rejected";
}

export type AppEnv = {
  Variables: {
    user: { id: string; email?: string };
    profile: Profile;
  };
};

const factory = createFactory<AppEnv>();

export const createRouter = () => factory.createApp();
export const createAppMiddleware = factory.createMiddleware;

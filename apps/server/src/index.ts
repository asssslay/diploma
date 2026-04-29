import { env } from "@my-better-t-app/env/server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import applications from "@/routes/admin/applications";
import adminNews from "@/routes/admin/news";
import adminEvents from "@/routes/admin/events";
import adminDiscussions from "@/routes/admin/discussions";
import news from "@/routes/news";
import events from "@/routes/events";
import discussionsRoute from "@/routes/discussions";
import deadlinesRoute from "@/routes/deadlines";
import notesRoute from "@/routes/notes";
import profile from "@/routes/profile";
import settingsRoute from "@/routes/settings";
export type { ActivityGate, RequiredProfileField } from "@/lib/activity-gate";

const app = new Hono();

if (env.NODE_ENV === "development") {
  app.use(logger());
}
app.use(
  "/*",
  cors({
    origin: env.CORS_ORIGIN,
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  }),
);

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ success: false, error: err.message }, err.status);
  }
  console.error(err);
  return c.json({ success: false, error: "Internal server error" }, 500);
});

app.get("/", (c) => {
  return c.text("OK");
});

app.get("/healthz", (c) => {
  return c.text("OK");
});

const routes = app
  .route("/api/admin/applications", applications)
  .route("/api/admin/news", adminNews)
  .route("/api/admin/events", adminEvents)
  .route("/api/news", news)
  .route("/api/events", events)
  .route("/api/discussions", discussionsRoute)
  .route("/api/admin/discussions", adminDiscussions)
  .route("/api/notes", notesRoute)
  .route("/api/deadlines", deadlinesRoute)
  .route("/api/profile", profile)
  .route("/api/settings", settingsRoute);

export type AppType = typeof routes;
export default app;

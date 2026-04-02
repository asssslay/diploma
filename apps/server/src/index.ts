import { env } from "@my-better-t-app/env/server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import applications from "@/routes/admin/applications";
import news from "@/routes/admin/news";

const app = new Hono();

app.use(logger());
app.use(
  "/*",
  cors({
    origin: env.CORS_ORIGIN,
    allowMethods: ["GET", "POST", "PATCH", "OPTIONS"],
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

const routes = app
  .route("/api/admin/applications", applications)
  .route("/api/admin/news", news);

export type AppType = typeof routes;
export default app;

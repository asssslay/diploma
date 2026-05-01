import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

function makeEmptyRoute() {
  return new Hono();
}

describe("app entrypoint", () => {
  beforeEach(async () => {
    vi.resetModules();
    const { resetTelemetryStateForTests } = await import("./lib/telemetry");
    resetTelemetryStateForTests();
  });

  it("responds to the root health check and applies cors headers", async () => {
    vi.doMock("@my-better-t-app/env/server", () => ({
      env: { CORS_ORIGIN: "http://localhost:3000" },
    }));
    vi.doMock("@/routes/admin/applications", () => ({ default: makeEmptyRoute() }));
    vi.doMock("@/routes/admin/news", () => ({ default: makeEmptyRoute() }));
    vi.doMock("@/routes/admin/events", () => ({ default: makeEmptyRoute() }));
    vi.doMock("@/routes/admin/discussions", () => ({ default: makeEmptyRoute() }));
    vi.doMock("@/routes/news", () => ({ default: makeEmptyRoute() }));
    vi.doMock("@/routes/events", () => ({ default: makeEmptyRoute() }));
    vi.doMock("@/routes/discussions", () => ({ default: makeEmptyRoute() }));
    vi.doMock("@/routes/deadlines", () => ({ default: makeEmptyRoute() }));
    vi.doMock("@/routes/notes", () => ({ default: makeEmptyRoute() }));
    vi.doMock("@/routes/profile", () => ({ default: makeEmptyRoute() }));
    vi.doMock("@/routes/settings", () => ({ default: makeEmptyRoute() }));

    const { default: app } = await import("./index");
    const response = await app.request("http://localhost/", {
      headers: { Origin: "http://localhost:3000" },
    });

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("OK");
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:3000",
    );
  });

  it("serializes HTTPException responses as json", async () => {
    const applications = new Hono().get("/http", () => {
      throw new HTTPException(418, { message: "Teapot" });
    });

    vi.doMock("@my-better-t-app/env/server", () => ({
      env: { CORS_ORIGIN: "*" },
    }));
    vi.doMock("@/routes/admin/applications", () => ({ default: applications }));
    vi.doMock("@/routes/admin/news", () => ({ default: makeEmptyRoute() }));
    vi.doMock("@/routes/admin/events", () => ({ default: makeEmptyRoute() }));
    vi.doMock("@/routes/admin/discussions", () => ({ default: makeEmptyRoute() }));
    vi.doMock("@/routes/news", () => ({ default: makeEmptyRoute() }));
    vi.doMock("@/routes/events", () => ({ default: makeEmptyRoute() }));
    vi.doMock("@/routes/discussions", () => ({ default: makeEmptyRoute() }));
    vi.doMock("@/routes/deadlines", () => ({ default: makeEmptyRoute() }));
    vi.doMock("@/routes/notes", () => ({ default: makeEmptyRoute() }));
    vi.doMock("@/routes/profile", () => ({ default: makeEmptyRoute() }));
    vi.doMock("@/routes/settings", () => ({ default: makeEmptyRoute() }));

    const { default: app } = await import("./index");
    const response = await app.request("http://localhost/api/admin/applications/http");

    expect(response.status).toBe(418);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Teapot",
    });
  });

  it("maps unexpected errors to a generic 500 response", async () => {
    const applications = new Hono().get("/boom", () => {
      throw new Error("boom");
    });

    vi.doMock("@my-better-t-app/env/server", () => ({
      env: { CORS_ORIGIN: "*" },
    }));
    vi.doMock("@/routes/admin/applications", () => ({ default: applications }));
    vi.doMock("@/routes/admin/news", () => ({ default: makeEmptyRoute() }));
    vi.doMock("@/routes/admin/events", () => ({ default: makeEmptyRoute() }));
    vi.doMock("@/routes/admin/discussions", () => ({ default: makeEmptyRoute() }));
    vi.doMock("@/routes/news", () => ({ default: makeEmptyRoute() }));
    vi.doMock("@/routes/events", () => ({ default: makeEmptyRoute() }));
    vi.doMock("@/routes/discussions", () => ({ default: makeEmptyRoute() }));
    vi.doMock("@/routes/deadlines", () => ({ default: makeEmptyRoute() }));
    vi.doMock("@/routes/notes", () => ({ default: makeEmptyRoute() }));
    vi.doMock("@/routes/profile", () => ({ default: makeEmptyRoute() }));
    vi.doMock("@/routes/settings", () => ({ default: makeEmptyRoute() }));

    const { default: app } = await import("./index");
    const response = await app.request("http://localhost/api/admin/applications/boom");

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Internal server error",
    });
  });

  it("returns telemetry for authorized monitoring requests", async () => {
    vi.doMock("@my-better-t-app/env/server", () => ({
      env: { CORS_ORIGIN: "*", MONITORING_TOKEN: "monitoring-secret" },
    }));
    vi.doMock("@/routes/admin/applications", () => ({ default: makeEmptyRoute() }));
    vi.doMock("@/routes/admin/news", () => ({ default: makeEmptyRoute() }));
    vi.doMock("@/routes/admin/events", () => ({ default: makeEmptyRoute() }));
    vi.doMock("@/routes/admin/discussions", () => ({ default: makeEmptyRoute() }));
    vi.doMock("@/routes/news", () => ({ default: makeEmptyRoute() }));
    vi.doMock("@/routes/events", () => ({ default: makeEmptyRoute() }));
    vi.doMock("@/routes/discussions", () => ({ default: makeEmptyRoute() }));
    vi.doMock("@/routes/deadlines", () => ({ default: makeEmptyRoute() }));
    vi.doMock("@/routes/notes", () => ({ default: makeEmptyRoute() }));
    vi.doMock("@/routes/profile", () => ({ default: makeEmptyRoute() }));
    vi.doMock("@/routes/settings", () => ({ default: makeEmptyRoute() }));

    const { default: app } = await import("./index");

    await app.request("http://localhost/");
    const response = await app.request("http://localhost/api/monitoring/telemetry", {
      headers: { Authorization: "Bearer monitoring-secret" },
    });

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body.requestLatency.sampleCount).toBe(1);
    expect(body.requestLatency.avgMs).toEqual(expect.any(Number));
    expect(body.process.cpu.utilizationPercent).toEqual(expect.any(Number));
    expect(body.process.memory.rssBytes).toEqual(expect.any(Number));
  });

  it("rejects monitoring requests without a valid bearer token", async () => {
    vi.doMock("@my-better-t-app/env/server", () => ({
      env: { CORS_ORIGIN: "*", MONITORING_TOKEN: "monitoring-secret" },
    }));
    vi.doMock("@/routes/admin/applications", () => ({ default: makeEmptyRoute() }));
    vi.doMock("@/routes/admin/news", () => ({ default: makeEmptyRoute() }));
    vi.doMock("@/routes/admin/events", () => ({ default: makeEmptyRoute() }));
    vi.doMock("@/routes/admin/discussions", () => ({ default: makeEmptyRoute() }));
    vi.doMock("@/routes/news", () => ({ default: makeEmptyRoute() }));
    vi.doMock("@/routes/events", () => ({ default: makeEmptyRoute() }));
    vi.doMock("@/routes/discussions", () => ({ default: makeEmptyRoute() }));
    vi.doMock("@/routes/deadlines", () => ({ default: makeEmptyRoute() }));
    vi.doMock("@/routes/notes", () => ({ default: makeEmptyRoute() }));
    vi.doMock("@/routes/profile", () => ({ default: makeEmptyRoute() }));
    vi.doMock("@/routes/settings", () => ({ default: makeEmptyRoute() }));

    const { default: app } = await import("./index");
    const response = await app.request("http://localhost/api/monitoring/telemetry");

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Unauthorized",
    });
  });
});

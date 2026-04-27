import { existsSync } from "node:fs";
import { join, normalize, sep } from "node:path";
import app from "./index";

const port = Number(process.env.PORT ?? 10000);
const webDistDir = join(process.cwd(), "apps", "web", "dist");
const spaEntry = join(webDistDir, "index.html");

function resolveStaticAsset(pathname: string) {
  const relativePath = pathname.replace(/^\/+/, "");
  const candidate = normalize(join(webDistDir, relativePath));

  if (candidate !== webDistDir && !candidate.startsWith(`${webDistDir}${sep}`)) {
    return null;
  }

  return existsSync(candidate) ? candidate : null;
}

const server = Bun.serve({
  port,
  fetch(request) {
    const { pathname } = new URL(request.url);

    if (pathname === "/healthz" || pathname === "/api" || pathname.startsWith("/api/")) {
      return app.fetch(request);
    }

    const assetPath = pathname === "/" ? spaEntry : resolveStaticAsset(pathname);
    if (assetPath) {
      return new Response(Bun.file(assetPath));
    }

    if (pathname.includes(".")) {
      return new Response("Not Found", { status: 404 });
    }

    return new Response(Bun.file(spaEntry));
  },
});

console.log(`Render server listening on port ${server.port}`);

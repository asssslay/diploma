# my-better-t-app

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines React, TanStack Router, Hono, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **TanStack Router** - File-based routing with full type safety
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **shadcn/ui** - Reusable UI components
- **Hono** - Lightweight, performant server framework
- **Bun** - Runtime environment
- **Turborepo** - Optimized monorepo build system

## Getting Started

First, install the dependencies:

```bash
pnpm install
```

Then, run the development server:

```bash
pnpm run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser to see the web application.
The API is running at [http://localhost:3000](http://localhost:3000).

## Project Structure

```
my-better-t-app/
├── apps/
│   ├── web/         # Frontend application (React + TanStack Router)
│   └── server/      # Backend API (Hono)
├── packages/
```

## Available Scripts

- `pnpm run dev`: Start all applications in development mode
- `pnpm run build`: Build all applications
- `pnpm run dev:web`: Start only the web application
- `pnpm run dev:server`: Start only the server
- `pnpm run check-types`: Check TypeScript types across all apps

## Deploy on Render

This repository now includes a root [`render.yaml`](./render.yaml) Blueprint for Render.

It deploys the project as a single Render web service:

- Render builds the Vite frontend in `apps/web`
- Bun runs `apps/server/src/render.ts`
- The Hono server serves the built SPA and handles `/api/*` on the same origin

This avoids cross-service CORS and public-URL wiring for the browser client.

### Setup

1. Push this repository to GitHub, GitLab, or Bitbucket.
2. In Render, open **New > Blueprint** and select this repository.
3. Render will detect `render.yaml` and prompt you for the secret env vars marked with `sync: false`.
4. Create the Blueprint and wait for the first deploy to finish.

### Required environment variables

- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Notes

- The build command sets `VITE_SERVER_URL` from Render's default `RENDER_EXTERNAL_URL`.
- The start command sets `CORS_ORIGIN` from the same Render-provided URL.
- Render's health check is configured to use `/healthz`.
- This setup follows Render's Blueprint, environment-variable, monorepo, and native Node/Bun runtime docs: [Render Docs](https://render.com/docs).

## Monitoring

Zabbix monitoring assets are available in [monitoring/zabbix/README.md](/D:/Projects/diploma/monitoring/zabbix/README.md).

The server now exposes a protected telemetry endpoint at `/api/monitoring/telemetry` for:

- rolling average response time under load
- process RSS memory consumption
- normalized CPU utilization

Set `MONITORING_TOKEN` in the runtime environment before enabling Zabbix polling.

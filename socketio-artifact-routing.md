---
name: Socket.io on api-server
description: How to add a realtime Socket.io server to the shared api-server artifact in this pnpm monorepo, and a restart gotcha to avoid.
---

When adding realtime gameplay/chat to an Express `api-server` artifact in this monorepo:

- Mount Socket.io with an explicit `path` (e.g. `/ws/socket.io`) distinct from the REST `/api` prefix, and attach it to the raw `http.Server` (switch from `app.listen(...)` to `http.createServer(app)` + attach + `httpServer.listen(...)`).
- The new path segment (e.g. `/ws`) must be added to the api-server's `artifact.toml` `paths` list or the shared reverse proxy will 404 all Socket.io traffic even though the server itself is fine.
- Frontend clients must connect with the matching explicit `path` option (`io(origin, { path: "/ws/socket.io" })`), not the client default.

**Why:** the shared reverse proxy routes by path per-artifact `artifact.toml`, and Socket.io's client/server path must match exactly on both ends — a mismatch (or missing artifact.toml entry) produces silent 404s that look like a backend bug but are actually a proxy/config issue.

**How to apply:** after wiring any new route or realtime server into `api-server` (whether new files or edits to `index.ts`/`app.ts`/`routes/index.ts`), you MUST restart the `api-server` workflow before testing — it does not hot-reload (build-then-start dev script). It's easy to restart only the frontend workflow after a feature build and forget the backend is still running stale code with 404s on every new route.

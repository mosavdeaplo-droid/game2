# Guess Battle

A real-time 1v1 number-guessing duel game: pick a secret number 1-100, take turns guessing your opponent's with Higher/Lower/Correct hints, race the 20s turn clock, and win best-of-3 rounds to climb the ranks.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000), also hosts the Socket.io game server at `/ws`
- `pnpm --filter @workspace/guess-battle run dev` — run the game frontend
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + Socket.io (real-time game logic)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec) — used for REST endpoints only (players, leaderboard)
- Frontend: React + Vite (`guess-battle` artifact)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/api-server/src/game/` — game engine: `socket.ts` (Socket.io server, room/turn/round/match logic), `rooms.ts` (in-memory room store + room codes), `rank.ts` (rank tier computation), `profanity.ts` (chat filter), `types.ts` (shared game types)
- `artifacts/api-server/src/routes/players.ts`, `leaderboard.ts` — REST endpoints for player identity and leaderboard
- `lib/api-spec/openapi.yaml` — source of truth for REST contract (players/leaderboard/health only — game moves are Socket.io, not REST)
- `lib/db/src/schema/players.ts`, `matches.ts` — DB schema
- `artifacts/guess-battle/src/lib/GameContext.tsx`, `gameTypes.ts`, `socket.ts` — frontend real-time game client (socket connection, game state context, action functions)

## Architecture decisions

- Original spec called for Next.js/Socket.io/MongoDB/JWT; adapted to this workspace's stack: Express 5 + Postgres/Drizzle + React/Vite + OpenAPI/Orval codegen.
- Real-time gameplay (moves, turns, rounds, chat) runs over Socket.io mounted at `/ws` on the existing api-server — NOT modeled in OpenAPI, since it's not request/response REST.
- Player identity is lightweight and device-based (no full auth/JWT): a `deviceId` persisted in `localStorage` is registered once via `POST /players/register`, which creates or resumes a player. No passwords or sessions.
- Room/game state lives in-memory in the api-server process (not persisted), keyed by room code; only final match results are written to Postgres (`matches` table) for history/leaderboard purposes.

## Product

- Home: choose a username, then Play Now / Create Room / Join Room / Leaderboard / Profile.
- Room/game screen: lobby, secret number picking, turn-based guessing duel with live hints, timer, skip tracking, round/match results, in-match chat, reconnect handling.
- Leaderboard: ranked players by wins (Bronze → Silver → Gold → Platinum → Diamond).
- Profile: player stats and recent match history.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Socket.io is mounted at path `/ws/socket.io` on the api-server; the frontend client must connect with that explicit `path` option, not the default.
- The `/ws` path must be registered in the api-server's `artifact.toml` `paths` list or Socket.io traffic won't be proxied.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

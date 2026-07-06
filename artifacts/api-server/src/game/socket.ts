import type { Server as HttpServer } from "http";
import { Server, type Socket } from "socket.io";
import { eq } from "drizzle-orm";
import { db, playersTable, matchesTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { filterProfanity } from "./profanity";
import { computeRank } from "./rank";
import {
  createRoom,
  deleteRoom,
  findRoomBySocketId,
  generateRoomCode,
  getRoom,
} from "./rooms";
import type { Room, RoomMode, RoomPlayer, RoomSettings } from "./types";

const TURN_SECONDS = 20;
const TARGET_CHOICE_SECONDS = 10;
const MAX_SKIPS = 3;
const ROUNDS_TO_WIN = 2;
const GUESS_RATE_LIMIT_MS = 1000;
const DISCONNECT_TIMEOUT_MS = 60_000;
const CHAT_RATE_LIMIT_MS = 800;
const WIN_COINS = 50;
const LOSS_COINS = 10;

const MIN_ALLOWED_NUMBER = 1;
const MAX_ALLOWED_NUMBER = 1000;
const MIN_RANGE_WIDTH = 10;
const MIN_ROUNDS_TO_WIN = 1;
const MAX_ROUNDS_TO_WIN = 5;

function sanitizeRoomSettings(input: unknown): RoomSettings {
  const raw = (input ?? {}) as Partial<RoomSettings>;

  let minNumber = Number.isInteger(raw.minNumber) ? raw.minNumber! : 1;
  let maxNumber = Number.isInteger(raw.maxNumber) ? raw.maxNumber! : 100;
  let roundsToWin = Number.isInteger(raw.roundsToWin)
    ? raw.roundsToWin!
    : ROUNDS_TO_WIN;

  minNumber = Math.min(
    Math.max(minNumber, MIN_ALLOWED_NUMBER),
    MAX_ALLOWED_NUMBER,
  );
  maxNumber = Math.min(
    Math.max(maxNumber, MIN_ALLOWED_NUMBER),
    MAX_ALLOWED_NUMBER,
  );

  if (maxNumber - minNumber < MIN_RANGE_WIDTH) {
    maxNumber = Math.min(minNumber + MIN_RANGE_WIDTH, MAX_ALLOWED_NUMBER);
    minNumber = maxNumber - MIN_RANGE_WIDTH;
  }

  roundsToWin = Math.min(
    Math.max(roundsToWin, MIN_ROUNDS_TO_WIN),
    MAX_ROUNDS_TO_WIN,
  );

  const rawMaxPlayers = Number(raw.maxPlayers);
  const maxPlayers: 2 | 3 | 4 =
    rawMaxPlayers === 3 ? 3 : rawMaxPlayers === 4 ? 4 : 2;

  const rawMode: RoomMode = raw.mode === "teams" ? "teams" : "ffa";
  const mode: RoomMode = rawMode === "teams" && maxPlayers === 4 ? "teams" : "ffa";

  return { minNumber, maxNumber, roundsToWin, maxPlayers, mode };
}

const chatLastSentAt = new Map<string, number>();

function publicPlayer(p: RoomPlayer) {
  return {
    playerId: p.playerId,
    username: p.username,
    connected: p.connected,
    ready: p.ready,
    hasSecret: p.secret !== null,
    skipsUsed: p.skipsUsed,
    roundsWon: p.roundsWon,
    team: p.team,
    alive: p.alive,
  };
}

function publicRoom(room: Room) {
  return {
    code: room.code,
    status: room.status,
    round: room.round,
    currentTurnIndex: room.currentTurnIndex,
    targetIndex: room.targetIndex,
    turnEndsAt: room.turnEndsAt,
    players: room.players.map((p) => (p ? publicPlayer(p) : null)),
    settings: room.settings,
  };
}

function makePlayer(
  socketId: string,
  deviceId: string,
  playerId: string,
  username: string,
  team: 0 | 1 | null,
): RoomPlayer {
  return {
    socketId,
    deviceId,
    playerId,
    username,
    secret: null,
    ready: false,
    connected: true,
    skipsUsed: 0,
    guesses: [],
    roundsWon: 0,
    team,
    alive: true,
  };
}

function teamForSeat(mode: RoomMode, seatIndex: number): 0 | 1 | null {
  if (mode !== "teams") return null;
  return (seatIndex % 2) as 0 | 1;
}

function getValidTargets(room: Room, fromIndex: number): number[] {
  const me = room.players[fromIndex];
  if (!me) return [];
  const targets: number[] = [];
  room.players.forEach((p, i) => {
    if (!p || i === fromIndex || !p.alive) return;
    if (room.settings.mode === "teams" && p.team === me.team) return;
    targets.push(i);
  });
  return targets;
}

function findNextAliveIndex(room: Room, fromIndex: number): number | null {
  const n = room.players.length;
  for (let step = 1; step <= n; step++) {
    const idx = (fromIndex + step) % n;
    const p = room.players[idx];
    if (p && p.alive) return idx;
  }
  return null;
}

type RoundWinner =
  | { kind: "player"; index: number }
  | { kind: "team"; team: 0 | 1 };

function checkRoundWinner(room: Room): RoundWinner | null {
  const alive = room.players
    .map((p, i) => ({ p, i }))
    .filter((x) => x.p && x.p.alive);

  if (room.settings.mode === "teams") {
    const aliveTeams = new Set(alive.map((x) => x.p!.team));
    if (aliveTeams.size === 1) {
      const team = alive[0]?.p?.team;
      if (team === 0 || team === 1) return { kind: "team", team };
    }
    return null;
  }

  if (alive.length === 1) {
    return { kind: "player", index: alive[0]!.i };
  }
  return null;
}

export function attachGameServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    path: "/ws/socket.io",
    cors: { origin: "*" },
  });

  function broadcastRoom(room: Room) {
    io.to(room.code).emit("room:update", publicRoom(room));
  }

  function clearTurnTimer(room: Room) {
    if (room.turnTimer) {
      clearTimeout(room.turnTimer);
      room.turnTimer = null;
    }
  }

  function beginTurn(room: Room) {
    clearTurnTimer(room);
    const validTargets = getValidTargets(room, room.currentTurnIndex);

    if (validTargets.length === 0) {
      logger.error({ roomCode: room.code }, "beginTurn: no valid targets");
      return;
    }

    if (validTargets.length === 1) {
      room.targetIndex = validTargets[0]!;
      startPlayingPhase(room);
      return;
    }

    room.status = "choosing_target";
    room.targetIndex = null;
    room.turnEndsAt = Date.now() + TARGET_CHOICE_SECONDS * 1000;
    io.to(room.code).emit("game:chooseTargetPrompt", {
      currentTurnIndex: room.currentTurnIndex,
      turnEndsAt: room.turnEndsAt,
      validTargets,
      round: room.round,
    });
    broadcastRoom(room);
    room.turnTimer = setTimeout(
      () => handleTargetTimeout(room),
      TARGET_CHOICE_SECONDS * 1000,
    );
  }

  function startPlayingPhase(room: Room) {
    clearTurnTimer(room);
    room.status = "playing";
    room.turnEndsAt = Date.now() + TURN_SECONDS * 1000;
    io.to(room.code).emit("game:turn", {
      currentTurnIndex: room.currentTurnIndex,
      targetIndex: room.targetIndex,
      turnEndsAt: room.turnEndsAt,
      round: room.round,
    });
    broadcastRoom(room);
    room.turnTimer = setTimeout(
      () => handleGuessTimeout(room),
      TURN_SECONDS * 1000,
    );
  }

  function handleTargetTimeout(room: Room) {
    const validTargets = getValidTargets(room, room.currentTurnIndex);
    if (validTargets.length === 0) return;
    room.targetIndex =
      validTargets[Math.floor(Math.random() * validTargets.length)]!;
    startPlayingPhase(room);
  }

  function handleGuessTimeout(room: Room) {
    const player = room.players[room.currentTurnIndex];
    if (!player) return;
    player.skipsUsed += 1;
    io.to(room.code).emit("game:skip", {
      playerIndex: room.currentTurnIndex,
      skipsUsed: player.skipsUsed,
    });

    if (player.skipsUsed >= MAX_SKIPS) {
      player.alive = false;
      io.to(room.code).emit("game:eliminated", {
        playerIndex: room.currentTurnIndex,
        reason: "skips",
      });
      const winner = checkRoundWinner(room);
      if (winner) {
        void finishRound(room, winner);
        return;
      }
    }

    const next = findNextAliveIndex(room, room.currentTurnIndex);
    if (next === null) return;
    room.currentTurnIndex = next;
    beginTurn(room);
  }

  async function finishRound(room: Room, winner: RoundWinner) {
    clearTurnTimer(room);

    const winnerIndices: number[] =
      winner.kind === "player"
        ? [winner.index]
        : room.players
            .map((p, i) => (p && p.team === winner.team ? i : -1))
            .filter((i) => i !== -1);

    for (const i of winnerIndices) {
      const p = room.players[i];
      if (p) p.roundsWon += 1;
    }

    const scores = room.players.map((p) => p?.roundsWon ?? 0);
    io.to(room.code).emit("game:roundEnd", { winnerIndices, scores });

    const matchOver = winnerIndices.some(
      (i) => (room.players[i]?.roundsWon ?? 0) >= room.settings.roundsToWin,
    );

    if (matchOver) {
      room.status = "match_over";
      io.to(room.code).emit("game:matchEnd", { winnerIndices, scores });

      if (room.settings.maxPlayers === 2) {
        const winnerPlayer = room.players[winnerIndices[0]!];
        const loserIndex = winnerIndices[0] === 0 ? 1 : 0;
        const loserPlayer = room.players[loserIndex];
        if (winnerPlayer && loserPlayer) {
          await persistMatchResult(room, winnerPlayer, loserPlayer);
        }
      }

      broadcastRoom(room);
      return;
    }

    room.round += 1;
    room.status = "picking";
    room.targetIndex = null;
    for (const p of room.players) {
      if (p) {
        p.secret = null;
        p.ready = false;
        p.guesses = [];
        p.skipsUsed = 0;
        p.alive = true;
      }
    }
    broadcastRoom(room);
  }

  async function persistMatchResult(
    room: Room,
    winner: RoomPlayer,
    loser: RoomPlayer,
  ) {
    try {
      const [winnerRow] = await db
        .update(playersTable)
        .set({
          wins: (
            await db
              .select()
              .from(playersTable)
              .where(eq(playersTable.id, winner.playerId))
          )[0]!.wins + 1,
        })
        .where(eq(playersTable.id, winner.playerId))
        .returning();

      const [loserRow] = await db
        .update(playersTable)
        .set({
          losses: (
            await db
              .select()
              .from(playersTable)
              .where(eq(playersTable.id, loser.playerId))
          )[0]!.losses + 1,
        })
        .where(eq(playersTable.id, loser.playerId))
        .returning();

      if (winnerRow) {
        await db
          .update(playersTable)
          .set({
            coins: winnerRow.coins + WIN_COINS,
            rank: computeRank(winnerRow.wins),
          })
          .where(eq(playersTable.id, winner.playerId));
      }

      if (loserRow) {
        await db
          .update(playersTable)
          .set({ coins: loserRow.coins + LOSS_COINS })
          .where(eq(playersTable.id, loser.playerId));
      }

      await db.insert(matchesTable).values({
        playerOneId: winner.playerId,
        playerTwoId: loser.playerId,
        winnerId: winner.playerId,
        playerOneScore: winner.roundsWon,
        playerTwoScore: loser.roundsWon,
      });
    } catch (err) {
      logger.error({ err }, "Failed to persist match result");
    }
  }

  io.on("connection", (socket: Socket) => {
    socket.on(
      "room:create",
      (
        payload: {
          username: string;
          deviceId: string;
          playerId: string;
          settings?: Partial<RoomSettings>;
        },
        ack?: (res: unknown) => void,
      ) => {
        const { username, deviceId, playerId, settings } = payload ?? {};
        if (!username || !deviceId || !playerId) {
          ack?.({ success: false, error: "Missing player info" });
          return;
        }

        const sanitized = sanitizeRoomSettings(settings);
        const code = generateRoomCode();
        const players: (RoomPlayer | null)[] = new Array(
          sanitized.maxPlayers,
        ).fill(null);
        players[0] = makePlayer(
          socket.id,
          deviceId,
          playerId,
          username,
          teamForSeat(sanitized.mode, 0),
        );

        const room: Room = {
          code,
          createdAt: Date.now(),
          status: "waiting",
          players,
          round: 1,
          currentTurnIndex: 0,
          targetIndex: null,
          turnEndsAt: null,
          turnTimer: null,
          disconnectTimers: {},
          chat: [],
          lastGuessAt: {},
          settings: sanitized,
        };

        createRoom(room);
        socket.join(code);
        ack?.({ success: true, roomCode: code });
        broadcastRoom(room);
      },
    );

    socket.on(
      "room:join",
      (
        payload: {
          roomCode: string;
          username: string;
          deviceId: string;
          playerId: string;
        },
        ack?: (res: unknown) => void,
      ) => {
        const { roomCode, username, deviceId, playerId } = payload ?? {};
        const room = getRoom(roomCode ?? "");
        if (!room) {
          ack?.({ success: false, error: "Room not found" });
          return;
        }

        const existingIdx = room.players.findIndex(
          (p) => p?.deviceId === deviceId,
        );
        if (existingIdx !== -1) {
          const p = room.players[existingIdx]!;
          p.socketId = socket.id;
          p.connected = true;
          socket.join(room.code);
          ack?.({ success: true, roomCode: room.code });
          broadcastRoom(room);
          return;
        }

        const emptyIdx = room.players.findIndex((p) => p === null);
        if (emptyIdx === -1) {
          ack?.({ success: false, error: "Room is full" });
          return;
        }

        room.players[emptyIdx] = makePlayer(
          socket.id,
          deviceId,
          playerId,
          username,
          teamForSeat(room.settings.mode, emptyIdx),
        );

        const isFull = room.players.every((p) => p !== null);
        if (isFull) {
          room.status = "picking";
        }

        socket.join(room.code);
        ack?.({ success: true, roomCode: room.code });
        broadcastRoom(room);
      },
    );

    socket.on(
      "room:rejoin",
      (
        payload: { roomCode: string; deviceId: string },
        ack?: (res: unknown) => void,
      ) => {
        const { roomCode, deviceId } = payload ?? {};
        const room = getRoom(roomCode ?? "");
        if (!room) {
          ack?.({ success: false, error: "Room not found" });
          return;
        }
        const idx = room.players.findIndex((p) => p?.deviceId === deviceId);
        if (idx === -1) {
          ack?.({ success: false, error: "Not a member of this room" });
          return;
        }
        const player = room.players[idx];
        if (!player) return;
        player.socketId = socket.id;
        player.connected = true;
        const timer = room.disconnectTimers[deviceId];
        if (timer) {
          clearTimeout(timer);
          delete room.disconnectTimers[deviceId];
        }
        socket.join(room.code);
        ack?.({ success: true, roomCode: room.code });
        broadcastRoom(room);

        if (room.status === "playing" && room.turnEndsAt) {
          socket.emit("game:turn", {
            currentTurnIndex: room.currentTurnIndex,
            targetIndex: room.targetIndex,
            turnEndsAt: room.turnEndsAt,
            round: room.round,
          });
        } else if (room.status === "choosing_target" && room.turnEndsAt) {
          socket.emit("game:chooseTargetPrompt", {
            currentTurnIndex: room.currentTurnIndex,
            turnEndsAt: room.turnEndsAt,
            validTargets: getValidTargets(room, room.currentTurnIndex),
            round: room.round,
          });
        }
      },
    );

    socket.on(
      "room:setSecret",
      (
        payload: { roomCode: string; secret: number },
        ack?: (res: unknown) => void,
      ) => {
        const room =
          findRoomBySocketId(socket.id) ?? getRoom(payload?.roomCode ?? "");
        if (!room) {
          ack?.({ success: false, error: "Room not found" });
          return;
        }
        const idx = room.players.findIndex((p) => p?.socketId === socket.id);
        if (idx === -1) {
          ack?.({ success: false, error: "Not in this room" });
          return;
        }
        const player = room.players[idx];
        if (!player || player.ready) {
          ack?.({ success: false, error: "Secret already locked" });
          return;
        }
        const secret = Number(payload?.secret);
        const { minNumber, maxNumber } = room.settings;
        if (
          !Number.isInteger(secret) ||
          secret < minNumber ||
          secret > maxNumber
        ) {
          ack?.({
            success: false,
            error: `Secret must be between ${minNumber} and ${maxNumber}`,
          });
          return;
        }
        player.secret = secret;
        player.ready = true;
        ack?.({ success: true });
        broadcastRoom(room);

        const allReady = room.players.every((p) => p === null || p.ready);
        if (allReady && room.status === "picking") {
          room.currentTurnIndex = findNextAliveIndex(room, -1) ?? 0;
          beginTurn(room);
        }
      },
    );

    socket.on(
      "game:chooseTarget",
      (
        payload: { roomCode: string; targetIndex: number },
        ack?: (res: unknown) => void,
      ) => {
        const room =
          findRoomBySocketId(socket.id) ?? getRoom(payload?.roomCode ?? "");
        if (!room || room.status !== "choosing_target") {
          ack?.({ success: false, error: "Not choosing a target right now" });
          return;
        }
        const idx = room.players.findIndex((p) => p?.socketId === socket.id);
        if (idx !== room.currentTurnIndex) {
          ack?.({ success: false, error: "Not your turn" });
          return;
        }
        const validTargets = getValidTargets(room, idx);
        const targetIndex = Number(payload?.targetIndex);
        if (!validTargets.includes(targetIndex)) {
          ack?.({ success: false, error: "Invalid target" });
          return;
        }
        room.targetIndex = targetIndex;
        ack?.({ success: true });
        startPlayingPhase(room);
      },
    );

    socket.on(
      "game:guess",
      (
        payload: { roomCode: string; guess: number },
        ack?: (res: unknown) => void,
      ) => {
        const room =
          findRoomBySocketId(socket.id) ?? getRoom(payload?.roomCode ?? "");
        if (!room || room.status !== "playing") {
          ack?.({ success: false, error: "Game not in progress" });
          return;
        }
        const idx = room.players.findIndex((p) => p?.socketId === socket.id);
        if (idx !== room.currentTurnIndex) {
          ack?.({ success: false, error: "Not your turn" });
          return;
        }
        const player = room.players[idx];
        if (!player) return;

        const targetIdx = room.targetIndex;
        const target = targetIdx !== null ? room.players[targetIdx] : null;
        if (targetIdx === null || !target || target.secret === null) {
          ack?.({ success: false, error: "Target not ready" });
          return;
        }

        const now = Date.now();
        const last = room.lastGuessAt[player.deviceId] ?? 0;
        if (now - last < GUESS_RATE_LIMIT_MS) {
          ack?.({ success: false, error: "Guessing too fast" });
          return;
        }
        room.lastGuessAt[player.deviceId] = now;

        const guess = Number(payload?.guess);
        const { minNumber: guessMin, maxNumber: guessMax } = room.settings;
        if (
          !Number.isInteger(guess) ||
          guess < guessMin ||
          guess > guessMax
        ) {
          ack?.({
            success: false,
            error: `Guess must be between ${guessMin} and ${guessMax}`,
          });
          return;
        }

        if (
          player.guesses.some(
            (g) =>
              g.guess === guess &&
              g.turn === room.round &&
              g.targetIndex === targetIdx,
          )
        ) {
          ack?.({
            success: false,
            error: "Already guessed that number against this opponent this round",
          });
          return;
        }

        let hint: "higher" | "lower" | "correct";
        if (guess === target.secret) hint = "correct";
        else if (guess < target.secret) hint = "higher";
        else hint = "lower";

        player.guesses.push({ guess, hint, turn: room.round, targetIndex: targetIdx });
        ack?.({ success: true });

        io.to(room.code).emit("game:guessResult", {
          playerIndex: idx,
          targetIndex: targetIdx,
          guess,
          hint,
          round: room.round,
        });

        if (hint === "correct") {
          target.alive = false;
          io.to(room.code).emit("game:eliminated", {
            playerIndex: targetIdx,
            reason: "correct",
          });
          const winner = checkRoundWinner(room);
          if (winner) {
            void finishRound(room, winner);
            return;
          }
        }

        clearTurnTimer(room);
        const next = findNextAliveIndex(room, idx);
        if (next === null) return;
        room.currentTurnIndex = next;
        beginTurn(room);
      },
    );

    socket.on(
      "chat:send",
      (payload: { roomCode: string; message: string }) => {
        const room =
          findRoomBySocketId(socket.id) ?? getRoom(payload?.roomCode ?? "");
        if (!room) return;
        const player = room.players.find((p) => p?.socketId === socket.id);
        if (!player) return;

        const now = Date.now();
        const last = chatLastSentAt.get(player.deviceId) ?? 0;
        if (now - last < CHAT_RATE_LIMIT_MS) return;
        chatLastSentAt.set(player.deviceId, now);

        const raw = String(payload?.message ?? "").slice(0, 200).trim();
        if (!raw) return;
        const message = filterProfanity(raw);

        const entry = { from: player.username, message, at: now };
        room.chat.push(entry);
        if (room.chat.length > 100) room.chat.shift();
        io.to(room.code).emit("chat:message", entry);
      },
    );

    socket.on("room:leave", (payload: { roomCode: string }) => {
      const room = getRoom(payload?.roomCode ?? "");
      if (!room) return;
      handleLeave(room, socket.id);
    });

    socket.on("disconnect", () => {
      const room = findRoomBySocketId(socket.id);
      if (!room) return;
      const player = room.players.find((p) => p?.socketId === socket.id);
      if (!player) return;
      player.connected = false;
      broadcastRoom(room);

      const deviceId = player.deviceId;
      room.disconnectTimers[deviceId] = setTimeout(() => {
        const stillThere = room.players.find((p) => p?.deviceId === deviceId);
        if (stillThere && !stillThere.connected) {
          handleLeave(room, stillThere.socketId ?? "", true);
        }
      }, DISCONNECT_TIMEOUT_MS);
    });

    function handleLeave(room: Room, socketId: string, forced = false) {
      const idx = room.players.findIndex(
        (p) => p?.socketId === socketId || (forced && p && !p.connected),
      );
      if (idx === -1) return;

      io.to(room.code).emit("room:opponentLeft", { playerIndex: idx });
      clearTurnTimer(room);
      deleteRoom(room.code);
    }
  });

  logger.info("Game socket server attached at /ws/socket.io");
  return io;
}

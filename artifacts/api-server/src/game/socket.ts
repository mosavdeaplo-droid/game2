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
import type { Room, RoomPlayer, RoomSettings } from "./types";

const TURN_SECONDS = 20;
const MAX_SKIPS = 3;
const ROUNDS_TO_WIN = 2;
const GUESS_RATE_LIMIT_MS = 1000;
const DISCONNECT_TIMEOUT_MS = 60_000;
const CHAT_RATE_LIMIT_MS = 800;
const WIN_COINS = 50;
const LOSS_COINS = 10;

// Safe bounds for custom room settings — prevents abuse (e.g. a 1-1 range
// that makes guessing trivial, or a 999-round match that never ends).
const MIN_ALLOWED_NUMBER = 1;
const MAX_ALLOWED_NUMBER = 1000;
const MIN_RANGE_WIDTH = 10; // smallest allowed (maxNumber - minNumber)
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

  return { minNumber, maxNumber, roundsToWin };
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
  };
}

function publicRoom(room: Room) {
  return {
    code: room.code,
    status: room.status,
    round: room.round,
    currentTurnIndex: room.currentTurnIndex,
    turnEndsAt: room.turnEndsAt,
    players: room.players.map((p) => (p ? publicPlayer(p) : null)),
    settings: room.settings,
  };
}

function otherIndex(i: 0 | 1): 0 | 1 {
  return i === 0 ? 1 : 0;
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

  function startTurn(room: Room) {
    clearTurnTimer(room);
    room.turnEndsAt = Date.now() + TURN_SECONDS * 1000;
    io.to(room.code).emit("game:turn", {
      currentTurnIndex: room.currentTurnIndex,
      turnEndsAt: room.turnEndsAt,
      round: room.round,
    });
    room.turnTimer = setTimeout(() => {
      handleTurnTimeout(room);
    }, TURN_SECONDS * 1000);
  }

  function handleTurnTimeout(room: Room) {
    const player = room.players[room.currentTurnIndex];
    if (!player) return;
    player.skipsUsed += 1;
    io.to(room.code).emit("game:skip", {
      playerIndex: room.currentTurnIndex,
      skipsUsed: player.skipsUsed,
    });

    if (player.skipsUsed >= MAX_SKIPS) {
      void endRound(room, otherIndex(room.currentTurnIndex), "skips");
      return;
    }

    room.currentTurnIndex = otherIndex(room.currentTurnIndex);
    startTurn(room);
  }

  async function endRound(
    room: Room,
    winnerIndex: 0 | 1,
    reason: "correct" | "skips",
  ) {
    clearTurnTimer(room);
    const winner = room.players[winnerIndex];
    if (!winner) return;
    winner.roundsWon += 1;

    io.to(room.code).emit("game:roundEnd", {
      winnerIndex,
      reason,
      scores: [room.players[0]?.roundsWon ?? 0, room.players[1]?.roundsWon ?? 0],
    });

    if (winner.roundsWon >= room.settings.roundsToWin) {
      room.status = "match_over";
      const loserIndex = otherIndex(winnerIndex);
      const loser = room.players[loserIndex];

      io.to(room.code).emit("game:matchEnd", {
        winnerIndex,
        scores: [
          room.players[0]?.roundsWon ?? 0,
          room.players[1]?.roundsWon ?? 0,
        ],
      });

      if (winner && loser) {
        await persistMatchResult(room, winner, loser);
      }
      broadcastRoom(room);
      return;
    }

    room.round += 1;
    room.status = "picking";
    for (const p of room.players) {
      if (p) {
        p.secret = null;
        p.ready = false;
        p.guesses = [];
        p.skipsUsed = 0;
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

        const code = generateRoomCode();
        const room: Room = {
          code,
          createdAt: Date.now(),
          status: "waiting",
          players: [
            {
              socketId: socket.id,
              deviceId,
              playerId,
              username,
              secret: null,
              ready: false,
              connected: true,
              skipsUsed: 0,
              guesses: [],
              roundsWon: 0,
            },
            null,
          ],
          round: 1,
          currentTurnIndex: 0,
          turnEndsAt: null,
          turnTimer: null,
          disconnectTimers: {},
          chat: [],
          lastGuessAt: {},
          settings: sanitizeRoomSettings(settings),
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
        if (room.players[1] && room.players[1].deviceId !== deviceId) {
          ack?.({ success: false, error: "Room is full" });
          return;
        }

        room.players[1] = {
          socketId: socket.id,
          deviceId,
          playerId,
          username,
          secret: null,
          ready: false,
          connected: true,
          skipsUsed: 0,
          guesses: [],
          roundsWon: 0,
        };
        room.status = "picking";

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
        const player = room.players[idx as 0 | 1];
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
            turnEndsAt: room.turnEndsAt,
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
        const room = findRoomBySocketId(socket.id) ?? getRoom(payload?.roomCode ?? "");
        if (!room) {
          ack?.({ success: false, error: "Room not found" });
          return;
        }
        const idx = room.players.findIndex((p) => p?.socketId === socket.id);
        if (idx === -1) {
          ack?.({ success: false, error: "Not in this room" });
          return;
        }
        const player = room.players[idx as 0 | 1];
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

        const [p1, p2] = room.players;
        if (p1?.ready && p2?.ready && room.status === "picking") {
          room.status = "playing";
          room.currentTurnIndex = 0;
          broadcastRoom(room);
          startTurn(room);
        }
      },
    );

    socket.on(
      "game:guess",
      (
        payload: { roomCode: string; guess: number },
        ack?: (res: unknown) => void,
      ) => {
        const room = findRoomBySocketId(socket.id) ?? getRoom(payload?.roomCode ?? "");
        if (!room || room.status !== "playing") {
          ack?.({ success: false, error: "Game not in progress" });
          return;
        }
        const idx = room.players.findIndex((p) => p?.socketId === socket.id);
        if (idx !== room.currentTurnIndex) {
          ack?.({ success: false, error: "Not your turn" });
          return;
        }
        const player = room.players[idx as 0 | 1];
        if (!player) return;

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

        if (player.guesses.some((g) => g.guess === guess && g.turn === room.round)) {
          ack?.({ success: false, error: "Already guessed that number this round" });
          return;
        }

        const opponent = room.players[otherIndex(idx as 0 | 1)];
        if (!opponent || opponent.secret === null) {
          ack?.({ success: false, error: "Opponent not ready" });
          return;
        }

        let hint: "higher" | "lower" | "correct";
        if (guess === opponent.secret) hint = "correct";
        else if (guess < opponent.secret) hint = "higher";
        else hint = "lower";

        player.guesses.push({ guess, hint, turn: room.round });
        ack?.({ success: true });

        io.to(room.code).emit("game:guessResult", {
          playerIndex: idx,
          guess,
          hint,
          round: room.round,
        });

        if (hint === "correct") {
          void endRound(room, idx as 0 | 1, "correct");
          return;
        }

        clearTurnTimer(room);
        room.currentTurnIndex = otherIndex(idx as 0 | 1);
        startTurn(room);
      },
    );

    socket.on(
      "chat:send",
      (payload: { roomCode: string; message: string }) => {
        const room = findRoomBySocketId(socket.id) ?? getRoom(payload?.roomCode ?? "");
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

import type { Room } from "./types";

const rooms = new Map<string, Room>();

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateRoomCode(): string {
  let code: string;
  do {
    code = Array.from(
      { length: 5 },
      () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)],
    ).join("");
  } while (rooms.has(code));
  return code;
}

export function createRoom(room: Room): void {
  rooms.set(room.code, room);
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code.toUpperCase());
}

export function deleteRoom(code: string): void {
  const room = rooms.get(code);
  if (room?.turnTimer) clearTimeout(room.turnTimer);
  if (room) {
    for (const timer of Object.values(room.disconnectTimers)) {
      if (timer) clearTimeout(timer);
    }
  }
  rooms.delete(code);
}

export function findRoomBySocketId(socketId: string): Room | undefined {
  for (const room of rooms.values()) {
    if (room.players.some((p) => p?.socketId === socketId)) {
      return room;
    }
  }
  return undefined;
}

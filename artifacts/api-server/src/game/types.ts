export interface RoomPlayer {
  socketId: string | null;
  deviceId: string;
  playerId: string;
  username: string;
  secret: number | null;
  ready: boolean;
  connected: boolean;
  skipsUsed: number;
  guesses: GuessEntry[];
  roundsWon: number;
  // Multiplayer additions (2-4 players):
  team: 0 | 1 | null; // null in free-for-all mode; 0 or 1 in teams (2v2) mode
  alive: boolean; // false once this player's secret has been correctly guessed this round
}

export interface GuessEntry {
  guess: number;
  hint: "higher" | "lower" | "correct";
  turn: number;
  targetIndex: number;
}

export interface ChatEntry {
  from: string;
  message: string;
  at: number;
}

export type RoomStatus =
  | "waiting"
  | "picking"
  | "choosing_target"
  | "playing"
  | "round_over"
  | "match_over";

export type RoomMode = "ffa" | "teams";

export interface RoomSettings {
  minNumber: number;
  maxNumber: number;
  roundsToWin: number;
  maxPlayers: 2 | 3 | 4;
  mode: RoomMode; // "teams" (2v2) is only valid when maxPlayers === 4
}

export interface Room {
  code: string;
  createdAt: number;
  status: RoomStatus;
  // Fixed-length array (length === settings.maxPlayers); empty seats are null
  // until someone joins.
  players: (RoomPlayer | null)[];
  round: number;
  currentTurnIndex: number;
  targetIndex: number | null;
  turnEndsAt: number | null;
  turnTimer: ReturnType<typeof setTimeout> | null;
  disconnectTimers: Partial<Record<string, ReturnType<typeof setTimeout>>>;
  chat: ChatEntry[];
  lastGuessAt: Partial<Record<string, number>>;
  settings: RoomSettings;
}

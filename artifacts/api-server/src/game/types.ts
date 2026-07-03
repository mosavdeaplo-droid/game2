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
}

export interface GuessEntry {
  guess: number;
  hint: "higher" | "lower" | "correct";
  turn: number;
}

export interface ChatEntry {
  from: string;
  message: string;
  at: number;
}

export type RoomStatus =
  | "waiting"
  | "picking"
  | "playing"
  | "round_over"
  | "match_over";

export interface Room {
  code: string;
  createdAt: number;
  status: RoomStatus;
  players: [RoomPlayer, RoomPlayer | null];
  round: number;
  currentTurnIndex: 0 | 1;
  turnEndsAt: number | null;
  turnTimer: ReturnType<typeof setTimeout> | null;
  disconnectTimers: Partial<Record<string, ReturnType<typeof setTimeout>>>;
  chat: ChatEntry[];
  lastGuessAt: Partial<Record<string, number>>;
}

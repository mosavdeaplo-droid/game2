export interface PublicPlayer {
  playerId: string;
  username: string;
  connected: boolean;
  ready: boolean;
  hasSecret: boolean;
  skipsUsed: number;
  roundsWon: number;
}

export type RoomStatus =
  | "waiting"
  | "picking"
  | "playing"
  | "round_over"
  | "match_over";

export interface PublicRoom {
  code: string;
  status: RoomStatus;
  round: number;
  currentTurnIndex: 0 | 1;
  turnEndsAt: number | null;
  players: [PublicPlayer | null, PublicPlayer | null];
}

export interface GuessResultEvent {
  playerIndex: 0 | 1;
  guess: number;
  hint: "higher" | "lower" | "correct";
  round: number;
}

export interface ChatMessageEvent {
  from: string;
  message: string;
  at: number;
}

export interface TurnEvent {
  currentTurnIndex: 0 | 1;
  turnEndsAt: number;
  round: number;
}

export interface SkipEvent {
  playerIndex: 0 | 1;
  skipsUsed: number;
}

export interface RoundEndEvent {
  winnerIndex: 0 | 1;
  reason: "correct" | "skips";
  scores: [number, number];
}

export interface MatchEndEvent {
  winnerIndex: 0 | 1;
  scores: [number, number];
}

export interface AckResponse {
  success: boolean;
  error?: string;
  roomCode?: string;
}

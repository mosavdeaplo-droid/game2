export interface PublicPlayer {
  playerId: string;
  username: string;
  connected: boolean;
  ready: boolean;
  hasSecret: boolean;
  skipsUsed: number;
  roundsWon: number;
  team: 0 | 1 | null;
  alive: boolean;
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
  mode: RoomMode;
}

export interface PublicRoom {
  code: string;
  status: RoomStatus;
  round: number;
  currentTurnIndex: number;
  targetIndex: number | null;
  turnEndsAt: number | null;
  players: (PublicPlayer | null)[];
  settings: RoomSettings;
}

export interface GuessResultEvent {
  playerIndex: number;
  targetIndex: number;
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
  currentTurnIndex: number;
  targetIndex: number | null;
  turnEndsAt: number;
  round: number;
}

export interface ChooseTargetPromptEvent {
  currentTurnIndex: number;
  turnEndsAt: number;
  validTargets: number[];
  round: number;
}

export interface EliminatedEvent {
  playerIndex: number;
  reason: "correct" | "skips";
}

export interface SkipEvent {
  playerIndex: number;
  skipsUsed: number;
}

export interface RoundEndEvent {
  winnerIndices: number[];
  scores: number[];
}

export interface MatchEndEvent {
  winnerIndices: number[];
  scores: number[];
}

export interface AckResponse {
  success: boolean;
  error?: string;
  roomCode?: string;
}

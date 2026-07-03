import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getSocket } from "./socket";
import type {
  AckResponse,
  ChatMessageEvent,
  GuessResultEvent,
  MatchEndEvent,
  PublicRoom,
  RoundEndEvent,
  SkipEvent,
  TurnEvent,
} from "./gameTypes";

interface Identity {
  playerId: string;
  username: string;
  deviceId: string;
}

interface GameState {
  identity: Identity | null;
  room: PublicRoom | null;
  myIndex: 0 | 1 | null;
  guessLog: GuessResultEvent[];
  chat: ChatMessageEvent[];
  lastRoundEnd: RoundEndEvent | null;
  lastMatchEnd: MatchEndEvent | null;
  lastSkip: SkipEvent | null;
  turn: TurnEvent | null;
  opponentLeft: boolean;
  connected: boolean;
}

interface GameContextValue extends GameState {
  setIdentity: (identity: Identity) => void;
  createRoom: () => Promise<AckResponse>;
  joinRoom: (roomCode: string) => Promise<AckResponse>;
  rejoinRoom: (roomCode: string) => Promise<AckResponse>;
  setSecret: (secret: number) => Promise<AckResponse>;
  guess: (value: number) => Promise<AckResponse>;
  sendChat: (message: string) => void;
  leaveRoom: () => void;
  resetMatchState: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

const DEVICE_ID_KEY = "guess-battle-device-id";

export function getOrCreateDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentityState] = useState<Identity | null>(null);
  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [guessLog, setGuessLog] = useState<GuessResultEvent[]>([]);
  const [chat, setChat] = useState<ChatMessageEvent[]>([]);
  const [lastRoundEnd, setLastRoundEnd] = useState<RoundEndEvent | null>(null);
  const [lastMatchEnd, setLastMatchEnd] = useState<MatchEndEvent | null>(null);
  const [lastSkip, setLastSkip] = useState<SkipEvent | null>(null);
  const [turn, setTurn] = useState<TurnEvent | null>(null);
  const [opponentLeft, setOpponentLeft] = useState(false);
  const [connected, setConnected] = useState(false);
  const identityRef = useRef<Identity | null>(null);

  const setIdentity = useCallback((id: Identity) => {
    identityRef.current = id;
    setIdentityState(id);
  }, []);

  useEffect(() => {
    const socket = getSocket();

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onRoomUpdate = (payload: PublicRoom) => setRoom(payload);
    const onGuessResult = (payload: GuessResultEvent) =>
      setGuessLog((prev) => [...prev, payload]);
    const onChatMessage = (payload: ChatMessageEvent) =>
      setChat((prev) => [...prev, payload]);
    const onRoundEnd = (payload: RoundEndEvent) => {
      setLastRoundEnd(payload);
      setGuessLog([]);
    };
    const onMatchEnd = (payload: MatchEndEvent) => setLastMatchEnd(payload);
    const onSkip = (payload: SkipEvent) => setLastSkip(payload);
    const onTurn = (payload: TurnEvent) => setTurn(payload);
    const onOpponentLeft = () => setOpponentLeft(true);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("room:update", onRoomUpdate);
    socket.on("game:guessResult", onGuessResult);
    socket.on("chat:message", onChatMessage);
    socket.on("game:roundEnd", onRoundEnd);
    socket.on("game:matchEnd", onMatchEnd);
    socket.on("game:skip", onSkip);
    socket.on("game:turn", onTurn);
    socket.on("room:opponentLeft", onOpponentLeft);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("room:update", onRoomUpdate);
      socket.off("game:guessResult", onGuessResult);
      socket.off("chat:message", onChatMessage);
      socket.off("game:roundEnd", onRoundEnd);
      socket.off("game:matchEnd", onMatchEnd);
      socket.off("game:skip", onSkip);
      socket.off("game:turn", onTurn);
      socket.off("room:opponentLeft", onOpponentLeft);
    };
  }, []);

  const createRoom = useCallback((): Promise<AckResponse> => {
    return new Promise((resolve) => {
      const id = identityRef.current;
      if (!id) {
        resolve({ success: false, error: "No identity set" });
        return;
      }
      getSocket().emit(
        "room:create",
        { username: id.username, deviceId: id.deviceId, playerId: id.playerId },
        (res: AckResponse) => resolve(res),
      );
    });
  }, []);

  const joinRoom = useCallback((roomCode: string): Promise<AckResponse> => {
    return new Promise((resolve) => {
      const id = identityRef.current;
      if (!id) {
        resolve({ success: false, error: "No identity set" });
        return;
      }
      getSocket().emit(
        "room:join",
        {
          roomCode,
          username: id.username,
          deviceId: id.deviceId,
          playerId: id.playerId,
        },
        (res: AckResponse) => resolve(res),
      );
    });
  }, []);

  const rejoinRoom = useCallback((roomCode: string): Promise<AckResponse> => {
    return new Promise((resolve) => {
      const id = identityRef.current;
      if (!id) {
        resolve({ success: false, error: "No identity set" });
        return;
      }
      getSocket().emit(
        "room:rejoin",
        { roomCode, deviceId: id.deviceId },
        (res: AckResponse) => resolve(res),
      );
    });
  }, []);

  const setSecret = useCallback((secret: number): Promise<AckResponse> => {
    return new Promise((resolve) => {
      const roomCode = room?.code;
      if (!roomCode) {
        resolve({ success: false, error: "Not in a room" });
        return;
      }
      getSocket().emit(
        "room:setSecret",
        { roomCode, secret },
        (res: AckResponse) => resolve(res),
      );
    });
  }, [room]);

  const guess = useCallback((value: number): Promise<AckResponse> => {
    return new Promise((resolve) => {
      const roomCode = room?.code;
      if (!roomCode) {
        resolve({ success: false, error: "Not in a room" });
        return;
      }
      getSocket().emit(
        "game:guess",
        { roomCode, guess: value },
        (res: AckResponse) => resolve(res),
      );
    });
  }, [room]);

  const sendChat = useCallback((message: string) => {
    const roomCode = room?.code;
    if (!roomCode) return;
    getSocket().emit("chat:send", { roomCode, message });
  }, [room]);

  const leaveRoom = useCallback(() => {
    const roomCode = room?.code;
    if (roomCode) {
      getSocket().emit("room:leave", { roomCode });
    }
    setRoom(null);
    setGuessLog([]);
    setChat([]);
    setLastRoundEnd(null);
    setLastMatchEnd(null);
    setLastSkip(null);
    setTurn(null);
    setOpponentLeft(false);
  }, [room]);

  const resetMatchState = useCallback(() => {
    setLastMatchEnd(null);
    setLastRoundEnd(null);
    setOpponentLeft(false);
  }, []);

  const myIndex: 0 | 1 | null = (() => {
    if (!room || !identity) return null;
    const idx = room.players.findIndex((p) => p?.playerId === identity.playerId);
    return idx === 0 || idx === 1 ? idx : null;
  })();

  const value: GameContextValue = {
    identity,
    room,
    myIndex,
    guessLog,
    chat,
    lastRoundEnd,
    lastMatchEnd,
    lastSkip,
    turn,
    opponentLeft,
    connected,
    setIdentity,
    createRoom,
    joinRoom,
    rejoinRoom,
    setSecret,
    guess,
    sendChat,
    leaveRoom,
    resetMatchState,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return ctx;
}

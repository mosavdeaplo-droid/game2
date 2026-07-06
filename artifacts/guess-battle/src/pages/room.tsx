import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useGame } from "@/lib/GameContext";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Send, Skull } from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function Room() {
  const { code } = useParams();
  const [, setLocation] = useLocation();
  const {
    room, myIndex, guessLog, chat, turn, chooseTargetPrompt, opponentLeft,
    leaveRoom, rejoinRoom, setSecret, chooseTarget, guess, sendChat, resetMatchState
  } = useGame();
  const { t } = useI18n();
  const { toast } = useToast();

  const [secretInput, setSecretInput] = useState("");
  const [guessInput, setGuessInput] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    if (!room && code) {
      rejoinRoom(code).then(res => {
        if (!res.success) {
          toast({ title: t("home.joinRoomFailed"), description: res.error, variant: "destructive" });
          setLocation("/");
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, room, rejoinRoom, setLocation, toast]);

  const activeEndsAt = turn?.turnEndsAt ?? chooseTargetPrompt?.turnEndsAt ?? null;
  useEffect(() => {
    if (!activeEndsAt) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((activeEndsAt - Date.now()) / 1000));
      setTimeLeft(remaining);
    }, 100);
    return () => clearInterval(interval);
  }, [activeEndsAt]);

  const minNumber = room?.settings?.minNumber ?? 1;
  const maxNumber = room?.settings?.maxNumber ?? 100;
  const isTeams = room?.settings?.mode === "teams";

  const handleSetSecret = () => {
    const val = parseInt(secretInput);
    if (isNaN(val) || val < minNumber || val > maxNumber) return;
    setSecret(val);
  };

  const handleGuess = () => {
    const val = parseInt(guessInput);
    if (isNaN(val) || val < minNumber || val > maxNumber) return;
    guess(val);
    setGuessInput("");
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendChat(chatInput);
    setChatInput("");
  };

  if (!room) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const me = myIndex !== null ? room.players[myIndex] : null;
  const isMyTurn = turn?.currentTurnIndex === myIndex;
  const isMyChoiceTurn = chooseTargetPrompt?.currentTurnIndex === myIndex;
  const currentTurnPlayer =
    turn !== null
      ? room.players[turn.currentTurnIndex]
      : chooseTargetPrompt !== null
        ? room.players[chooseTargetPrompt.currentTurnIndex]
        : null;
  const targetPlayer = turn?.targetIndex != null ? room.players[turn.targetIndex] : null;

  const seatsFilled = room.players.filter((p) => p !== null).length;
  const seatsTotal = room.players.length;

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      <header className="p-4 border-b border-border flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => { leaveRoom(); setLocation("/"); }}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="text-center">
          <div className="font-mono text-sm text-muted-foreground">{t("room.roomCode")}</div>
          <div className="font-bold text-xl tracking-widest">{room.code}</div>
        </div>
        <LanguageSwitcher />
      </header>

      <main className="flex-1 flex flex-col md:flex-row gap-4 p-4 max-w-6xl mx-auto w-full">
        {/* Game Area */}
        <div className="flex-1 flex flex-col gap-4">
          {/* Player roster */}
          <Card className="p-3 bg-card/50">
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${seatsTotal}, minmax(0,1fr))` }}>
              {room.players.map((p, i) => (
                <div
                  key={i}
                  className={`rounded-lg p-2 text-center border
                    ${i === myIndex ? "border-primary bg-primary/10" : "border-border/50 bg-background/40"}
                    ${p && !p.alive ? "opacity-40" : ""}
                    ${isTeams && p?.team === 0 ? "ring-1 ring-blue-500/40" : ""}
                    ${isTeams && p?.team === 1 ? "ring-1 ring-pink-500/40" : ""}
                  `}
                >
                  <div className="text-xs font-mono truncate">
                    {p ? (i === myIndex ? t("room.you") : p.username) : t("room.waitingLabel")}
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground flex items-center justify-center gap-1">
                    {p && !p.alive && <Skull className="w-3 h-3" />}
                    {t("room.wins")}: {p?.roundsWon ?? 0}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {room.status === "waiting" && (
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
              <Loader2 className="w-12 h-12 animate-spin text-muted-foreground" />
              <h2 className="text-2xl font-bold">
                {t("room.waitingRoom")} ({seatsFilled}/{seatsTotal})
              </h2>
              <p className="font-mono text-muted-foreground">{t("room.shareCode")}: {room.code}</p>
            </div>
          )}

          {room.status === "picking" && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 border-2 border-dashed border-primary/30 rounded-xl">
              <h2 className="text-3xl font-black italic mb-6">{t("room.pickSecret")}</h2>
              <p className="text-muted-foreground mb-8 text-center max-w-sm">
                {t("room.pickSecretDesc", { min: minNumber, max: maxNumber })}
              </p>
              {me?.hasSecret ? (
                <div className="text-xl text-primary font-bold animate-pulse">{t("room.waitingOpponentSecret")}</div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={minNumber} max={maxNumber}
                    value={secretInput}
                    onChange={e => setSecretInput(e.target.value)}
                    className="w-32 text-center text-2xl h-14 font-mono"
                    placeholder={`${minNumber}-${maxNumber}`}
                  />
                  <Button
                    onClick={handleSetSecret}
                    className="h-14 px-8 text-lg font-bold bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {t("room.lockIn")}
                  </Button>
                </div>
              )}
            </div>
          )}

          {room.status === "choosing_target" && chooseTargetPrompt && (
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <div className="mb-4 text-center">
                <div className="text-sm font-mono text-muted-foreground mb-2">{t("room.round")} {room.round}</div>
                <div className={`text-6xl font-mono ${timeLeft <= 3 ? 'text-destructive animate-bounce' : ''}`}>
                  00:{timeLeft.toString().padStart(2, '0')}
                </div>
              </div>

              {isMyChoiceTurn ? (
                <>
                  <h2 className="text-2xl font-black italic mb-2">{t("room.chooseTarget")}</h2>
                  <p className="text-muted-foreground mb-6">{t("room.chooseTargetDesc")}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-sm">
                    {chooseTargetPrompt.validTargets.map((idx) => {
                      const p = room.players[idx];
                      if (!p) return null;
                      return (
                        <Button
                          key={idx}
                          onClick={() => chooseTarget(idx)}
                          variant="outline"
                          className="h-16 text-lg font-bold border-primary/30 hover:bg-primary/10 hover:text-primary"
                        >
                          {p.username}
                        </Button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="text-xl font-bold text-secondary animate-pulse text-center">
                  {currentTurnPlayer?.username} — {t("room.chooseTarget")}...
                </div>
              )}
            </div>
          )}

          {room.status === "playing" && (
            <div className="flex-1 flex flex-col items-center p-4">
              <div className="mb-8 text-center">
                <div className="text-sm font-mono text-muted-foreground mb-2">{t("room.round")} {room.round}</div>
                {isMyTurn ? (
                  <div className="text-4xl font-black text-primary animate-pulse">
                    {t("room.yourTurn")} → {targetPlayer?.username}
                  </div>
                ) : (
                  <div className="text-3xl font-black text-secondary">
                    {currentTurnPlayer?.username} → {myIndex === turn?.targetIndex ? t("room.you") : targetPlayer?.username}
                  </div>
                )}
                <div className={`text-6xl font-mono mt-4 ${timeLeft <= 5 ? 'text-destructive animate-bounce' : ''}`}>
                  00:{timeLeft.toString().padStart(2, '0')}
                </div>
              </div>

              {isMyTurn && (
                <div className="flex gap-2 w-full max-w-sm">
                  <Input
                    type="number"
                    min={minNumber} max={maxNumber}
                    value={guessInput}
                    onChange={e => setGuessInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleGuess()}
                    className="h-16 text-3xl text-center font-mono"
                    placeholder={t("room.guessPlaceholder")}
                    autoFocus
                  />
                  <Button
                    onClick={handleGuess}
                    className="h-16 px-8 text-xl font-bold bg-primary text-primary-foreground"
                  >
                    {t("room.guess")}
                  </Button>
                </div>
              )}

              <ScrollArea className="flex-1 w-full max-w-md mt-8 border rounded-lg bg-card p-4">
                <div className="space-y-2">
                  {guessLog.map((log, i) => {
                    const guesser = room.players[log.playerIndex];
                    const targeted = room.players[log.targetIndex];
                    const isMine = log.playerIndex === myIndex;
                    return (
                      <div key={i} className={`flex items-center gap-3 ${isMine ? 'flex-row' : 'flex-row-reverse'}`}>
                        <div className={`font-mono text-xl font-bold ${isMine ? 'text-primary' : 'text-secondary'}`}>
                          {log.guess}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {guesser?.username} → {targeted?.username}
                        </div>
                        <div className={`px-3 py-1 rounded text-sm font-bold uppercase
                          ${log.hint === 'correct' ? 'bg-green-500/20 text-green-500' : 'bg-muted text-muted-foreground'}
                        `}>
                          {log.hint === 'correct' ? t("room.correct") : log.hint === 'higher' ? t("room.higher") : t("room.lower")}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}

          {(room.status === "round_over" || room.status === "match_over") && (
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
              <h2 className="text-5xl font-black italic">
                {room.status === "match_over" ? t("room.matchOver") : t("room.roundOver")}
              </h2>
              <Button onClick={() => { resetMatchState(); setLocation('/'); }} variant="outline">
                {t("room.backToHome")}
              </Button>
            </div>
          )}
        </div>

        {/* Chat / Sidebar */}
        <Card className="w-full md:w-80 flex flex-col h-64 md:h-auto bg-card/50">
          <div className="p-3 border-b font-bold font-mono text-sm">{t("room.matchChat")}</div>
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {chat.map((msg, i) => {
                const isMe = msg.from === me?.username;
                return (
                  <div key={i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className="text-xs text-muted-foreground mb-1">{msg.from}</div>
                    <div className={`px-3 py-2 rounded-lg text-sm ${isMe ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                      {msg.message}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
          <form onSubmit={handleSendChat} className="p-3 border-t flex gap-2">
            <Input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder={t("room.chatPlaceholder")}
              className="bg-background"
            />
            <Button type="submit" size="icon" variant="ghost">
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </Card>
      </main>

      {opponentLeft && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur z-50 flex items-center justify-center">
          <Card className="p-8 text-center space-y-4 max-w-sm">
            <h2 className="text-2xl font-bold text-destructive">{t("room.opponentLeftTitle")}</h2>
            <p className="text-muted-foreground">{t("room.opponentLeftDesc")}</p>
            <Button onClick={() => setLocation('/')} className="w-full">{t("room.returnHome")}</Button>
          </Card>
        </div>
      )}
    </div>
  );
}

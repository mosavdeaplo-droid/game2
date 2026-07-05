import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useGame, getOrCreateDeviceId } from "@/lib/GameContext";
import { useI18n } from "@/lib/i18n";
import { useRegisterPlayer } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Swords, Trophy, User as UserIcon, Settings } from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

const MIN_ALLOWED_NUMBER = 1;
const MAX_ALLOWED_NUMBER = 1000;

export default function Home() {
  const [, setLocation] = useLocation();
  const { identity, setIdentity, createRoom, joinRoom, connected } = useGame();
  const { t } = useI18n();
  const registerPlayer = useRegisterPlayer();
  const { toast } = useToast();

  const [username, setUsername] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [isInitializing, setIsInitializing] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // Custom room settings — defaults match the original 1-100 / best-of-3 game.
  const [numberRange, setNumberRange] = useState<[number, number]>([1, 100]);
  const [roundsToWin, setRoundsToWin] = useState(2);

  useEffect(() => {
    const init = async () => {
      const deviceId = getOrCreateDeviceId();
      const localIdentity = localStorage.getItem("guess-battle-identity");

      if (localIdentity) {
        try {
          const parsed = JSON.parse(localIdentity);
          setIdentity(parsed);
        } catch (e) {
          // ignore
        }
      }
      setIsInitializing(false);
    };
    init();
  }, [setIdentity]);

  const handleRegister = () => {
    if (!username || username.length < 2 || username.length > 20) {
      toast({
        title: t("home.invalidUsername"),
        description: t("home.invalidUsernameDesc"),
        variant: "destructive",
      });
      return;
    }

    const deviceId = getOrCreateDeviceId();
    registerPlayer.mutate(
      { data: { username, deviceId } },
      {
        onSuccess: (player) => {
          const idObj = { playerId: player.id, username: player.username, deviceId };
          setIdentity(idObj);
          localStorage.setItem("guess-battle-identity", JSON.stringify(idObj));
        },
        onError: () => {
          toast({ title: t("home.registerFailed"), variant: "destructive" });
        },
      },
    );
  };

  const handleCreateRoom = async (useCustomSettings: boolean) => {
    setIsCreating(true);
    const settings = useCustomSettings
      ? {
          minNumber: numberRange[0],
          maxNumber: numberRange[1],
          roundsToWin,
        }
      : undefined;
    const res = await createRoom(settings);
    setIsCreating(false);
    if (res.success && res.roomCode) {
      setLocation(`/room/${res.roomCode}`);
    } else {
      toast({
        title: t("home.createRoomFailed"),
        description: res.error,
        variant: "destructive",
      });
    }
  };

  const handleJoinRoom = async () => {
    if (!roomCode) return;
    const res = await joinRoom(roomCode.toUpperCase());
    if (res.success && res.roomCode) {
      setLocation(`/room/${res.roomCode}`);
    } else {
      toast({
        title: t("home.joinRoomFailed"),
        description: res.error,
        variant: "destructive",
      });
    }
  };

  if (isInitializing) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col items-center justify-center p-4">
      <div className="absolute top-4 right-4 flex items-center gap-3 text-sm font-mono">
        <LanguageSwitcher />
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connected ? "bg-primary" : "bg-destructive"}`} />
          <span className={connected ? "text-primary" : "text-destructive"}>
            {connected ? t("status.connected") : t("status.disconnected")}
          </span>
        </div>
      </div>

      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-6xl font-black italic tracking-tighter text-primary uppercase drop-shadow-md">
            {t("app.title")}
          </h1>
          <p className="text-muted-foreground font-mono">{t("app.tagline")}</p>
        </div>

        {!identity ? (
          <Card className="p-6 border-primary/20 bg-card/50 backdrop-blur">
            <h2 className="text-2xl font-bold mb-4">{t("home.chooseAlias")}</h2>
            <div className="flex gap-2">
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t("home.usernamePlaceholder")}
                className="font-mono bg-background border-primary/30 focus-visible:ring-primary"
                onKeyDown={(e) => e.key === "Enter" && handleRegister()}
              />
              <Button
                onClick={handleRegister}
                disabled={registerPlayer.isPending}
                className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
              >
                {registerPlayer.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  t("home.start")
                )}
              </Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => handleCreateRoom(false)}
                  disabled={isCreating}
                  className="h-24 text-xl flex flex-col gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Swords className="w-8 h-8" />
                  {t("home.createRoom")}
                </Button>

                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-primary/30 text-muted-foreground hover:text-primary"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      {t("home.roomSettings")}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-card border-primary/20">
                    <DialogHeader>
                      <DialogTitle>{t("home.roomSettings")}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 py-2">
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm font-mono text-muted-foreground">
                          <span>{t("home.numberRange")}</span>
                          <span>
                            {numberRange[0]} – {numberRange[1]}
                          </span>
                        </div>
                        <Slider
                          value={numberRange}
                          min={MIN_ALLOWED_NUMBER}
                          max={MAX_ALLOWED_NUMBER}
                          step={1}
                          minStepsBetweenThumbs={10}
                          onValueChange={(val) =>
                            setNumberRange([val[0] ?? 1, val[1] ?? 100])
                          }
                        />
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between text-sm font-mono text-muted-foreground">
                          <span>{t("home.roundsToWin")}</span>
                          <span>{roundsToWin}</span>
                        </div>
                        <Slider
                          value={[roundsToWin]}
                          min={1}
                          max={5}
                          step={1}
                          onValueChange={(val) => setRoundsToWin(val[0] ?? 2)}
                        />
                      </div>

                      <Button
                        onClick={() => handleCreateRoom(true)}
                        disabled={isCreating}
                        className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
                      >
                        {isCreating ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          t("home.startCustomGame")
                        )}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="space-y-2">
                <Input
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder={t("home.roomCodePlaceholder")}
                  className="h-11 font-mono text-center text-lg bg-background border-primary/30 uppercase"
                  maxLength={6}
                />
                <Button
                  onClick={handleJoinRoom}
                  disabled={!roomCode}
                  variant="outline"
                  className="w-full h-11 border-primary/30 hover:bg-primary/10 hover:text-primary font-bold"
                >
                  {t("home.joinGame")}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Link href="/leaderboard" className="w-full">
                <Button
                  variant="outline"
                  className="w-full border-muted/50 text-muted-foreground hover:text-foreground"
                >
                  <Trophy className="w-4 h-4 mr-2" />
                  {t("home.leaderboard")}
                </Button>
              </Link>
              <Link href={`/profile/${identity.playerId}`} className="w-full">
                <Button
                  variant="outline"
                  className="w-full border-muted/50 text-muted-foreground hover:text-foreground"
                >
                  <UserIcon className="w-4 h-4 mr-2" />
                  {t("home.profile")}
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

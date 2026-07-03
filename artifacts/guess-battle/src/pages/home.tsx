import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useGame, getOrCreateDeviceId } from "@/lib/GameContext";
import { useRegisterPlayer } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Swords, Trophy, User as UserIcon } from "lucide-react";

export default function Home() {
  const [, setLocation] = useLocation();
  const { identity, setIdentity, createRoom, joinRoom, connected } = useGame();
  const registerPlayer = useRegisterPlayer();
  const { toast } = useToast();

  const [username, setUsername] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [isInitializing, setIsInitializing] = useState(true);

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
      toast({ title: "Invalid username", description: "Must be 2-20 characters", variant: "destructive" });
      return;
    }
    
    const deviceId = getOrCreateDeviceId();
    registerPlayer.mutate({ data: { username, deviceId } }, {
      onSuccess: (player) => {
        const idObj = { playerId: player.id, username: player.username, deviceId };
        setIdentity(idObj);
        localStorage.setItem("guess-battle-identity", JSON.stringify(idObj));
      },
      onError: () => {
        toast({ title: "Failed to register", variant: "destructive" });
      }
    });
  };

  const handleCreateRoom = async () => {
    const res = await createRoom();
    if (res.success && res.roomCode) {
      setLocation(`/room/${res.roomCode}`);
    } else {
      toast({ title: "Failed to create room", description: res.error, variant: "destructive" });
    }
  };

  const handleJoinRoom = async () => {
    if (!roomCode) return;
    const res = await joinRoom(roomCode.toUpperCase());
    if (res.success && res.roomCode) {
      setLocation(`/room/${res.roomCode}`);
    } else {
      toast({ title: "Failed to join room", description: res.error, variant: "destructive" });
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
      <div className="absolute top-4 right-4 flex items-center gap-2 text-sm font-mono">
        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-primary' : 'bg-destructive'}`} />
        <span className={connected ? 'text-primary' : 'text-destructive'}>
          {connected ? 'CONNECTED' : 'DISCONNECTED'}
        </span>
      </div>

      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-6xl font-black italic tracking-tighter text-primary uppercase drop-shadow-md">
            Guess Battle
          </h1>
          <p className="text-muted-foreground font-mono">The Ultimate Number Duel</p>
        </div>

        {!identity ? (
          <Card className="p-6 border-primary/20 bg-card/50 backdrop-blur">
            <h2 className="text-2xl font-bold mb-4">Choose your alias</h2>
            <div className="flex gap-2">
              <Input 
                value={username} 
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username (2-20 chars)"
                className="font-mono bg-background border-primary/30 focus-visible:ring-primary"
                onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
              />
              <Button 
                onClick={handleRegister}
                disabled={registerPlayer.isPending}
                className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
              >
                {registerPlayer.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Start'}
              </Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Button 
                onClick={handleCreateRoom} 
                className="h-24 text-xl flex flex-col gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Swords className="w-8 h-8" />
                Create Room
              </Button>
              <div className="space-y-2">
                <Input 
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="ROOM CODE"
                  className="h-11 font-mono text-center text-lg bg-background border-primary/30 uppercase"
                  maxLength={6}
                />
                <Button 
                  onClick={handleJoinRoom}
                  disabled={!roomCode}
                  variant="outline"
                  className="w-full h-11 border-primary/30 hover:bg-primary/10 hover:text-primary font-bold"
                >
                  Join Game
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Link href="/leaderboard" className="w-full">
                <Button variant="outline" className="w-full border-muted/50 text-muted-foreground hover:text-foreground">
                  <Trophy className="w-4 h-4 mr-2" />
                  Leaderboard
                </Button>
              </Link>
              <Link href={`/profile/${identity.playerId}`} className="w-full">
                <Button variant="outline" className="w-full border-muted/50 text-muted-foreground hover:text-foreground">
                  <UserIcon className="w-4 h-4 mr-2" />
                  Profile
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

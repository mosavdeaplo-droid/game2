import { useParams, Link } from "wouter";
import {
  useGetPlayer,
  useGetPlayerMatches,
  getGetPlayerQueryKey,
  getGetPlayerMatchesQueryKey,
} from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Loader2, User as UserIcon } from "lucide-react";
import { format } from "date-fns";

export default function Profile() {
  const { id } = useParams();
  const { data: player, isLoading: isLoadingPlayer } = useGetPlayer(id || "", {
    query: { enabled: !!id, queryKey: getGetPlayerQueryKey(id || "") },
  });
  const { data: matches, isLoading: isLoadingMatches } = useGetPlayerMatches(id || "", {
    query: { enabled: !!id, queryKey: getGetPlayerMatchesQueryKey(id || "") },
  });

  if (isLoadingPlayer) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!player) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background p-4 text-center">
        <h1 className="text-2xl font-bold mb-4">Player Not Found</h1>
        <Link href="/">
          <Button variant="outline">Return Home</Button>
        </Link>
      </div>
    );
  }

  const winRate = player.gamesPlayed > 0 
    ? Math.round((player.wins / player.gamesPlayed) * 100) 
    : 0;

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col max-w-3xl mx-auto">
      <header className="p-4 flex items-center gap-4 border-b border-border/50">
        <Link href="/">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
        </Link>
        <h1 className="text-2xl font-black italic tracking-tight flex items-center gap-2 uppercase">
          <UserIcon className="w-6 h-6 text-primary" /> {player.username}
        </h1>
      </header>

      <main className="flex-1 p-4 flex flex-col gap-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4 bg-card/50 flex flex-col items-center justify-center text-center">
            <div className="text-sm font-mono text-muted-foreground mb-1">RANK</div>
            <div className="text-xl font-bold text-primary">{player.rank}</div>
          </Card>
          <Card className="p-4 bg-card/50 flex flex-col items-center justify-center text-center">
            <div className="text-sm font-mono text-muted-foreground mb-1">WIN RATE</div>
            <div className="text-xl font-bold">{winRate}%</div>
          </Card>
          <Card className="p-4 bg-card/50 flex flex-col items-center justify-center text-center">
            <div className="text-sm font-mono text-muted-foreground mb-1">MATCHES</div>
            <div className="text-xl font-bold">{player.gamesPlayed}</div>
          </Card>
          <Card className="p-4 bg-card/50 flex flex-col items-center justify-center text-center">
            <div className="text-sm font-mono text-muted-foreground mb-1">COINS</div>
            <div className="text-xl font-bold text-accent">{player.coins}</div>
          </Card>
        </div>

        <div className="space-y-4 flex-1 flex flex-col">
          <h2 className="text-xl font-black italic">RECENT MATCHES</h2>
          
          <ScrollArea className="flex-1 bg-card/30 rounded-xl border border-border/50 p-4">
            {isLoadingMatches ? (
              <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : matches && matches.length > 0 ? (
              <div className="space-y-2">
                {matches.map((match) => (
                  <div key={match.id} className="flex items-center justify-between p-3 rounded bg-background/50 border border-border/50">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 text-center font-black py-1 rounded
                        ${match.result === 'win' ? 'bg-primary/20 text-primary' : 'bg-destructive/20 text-destructive'}
                      `}>
                        {match.result === 'win' ? 'WIN' : 'LOSS'}
                      </div>
                      <div>
                        <div className="font-bold">vs {match.opponentUsername}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {format(new Date(match.createdAt), 'MMM d, h:mm a')}
                        </div>
                      </div>
                    </div>
                    <div className="font-mono text-lg font-bold">
                      {match.playerScore} - {match.opponentScore}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center p-8 text-muted-foreground font-mono">
                No matches played yet.
              </div>
            )}
          </ScrollArea>
        </div>
      </main>
    </div>
  );
}

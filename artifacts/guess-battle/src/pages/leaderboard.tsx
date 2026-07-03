import { Link } from "wouter";
import { useGetLeaderboard } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Loader2, Trophy } from "lucide-react";

export default function Leaderboard() {
  const { data: leaderboard, isLoading } = useGetLeaderboard();

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col max-w-3xl mx-auto">
      <header className="p-4 flex items-center gap-4 border-b border-border/50">
        <Link href="/">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
        </Link>
        <h1 className="text-2xl font-black italic tracking-tight flex items-center gap-2">
          <Trophy className="w-6 h-6 text-primary" /> LEADERBOARD
        </h1>
      </header>

      <ScrollArea className="flex-1 p-4">
        {isLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-2">
            {leaderboard?.map((player, i) => (
              <Link key={player.id} href={`/profile/${player.id}`}>
                <Card className={`p-4 flex items-center gap-4 hover:bg-accent/5 transition-colors cursor-pointer border-border/50
                  ${i === 0 ? 'bg-primary/5 border-primary/30' : ''}
                `}>
                  <div className={`w-8 text-center font-mono font-bold text-lg
                    ${i === 0 ? 'text-primary' : 'text-muted-foreground'}
                  `}>
                    #{i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-lg">{player.username}</div>
                    <div className="text-sm text-muted-foreground flex gap-3 font-mono">
                      <span>{player.rank}</span>
                      <span className="text-primary">{player.wins} W</span>
                      <span className="text-destructive">{player.losses} L</span>
                    </div>
                  </div>
                  <div className="font-mono text-xl font-bold">
                    {player.coins} <span className="text-primary text-sm">C</span>
                  </div>
                </Card>
              </Link>
            ))}
            {leaderboard?.length === 0 && (
              <div className="text-center p-12 text-muted-foreground font-mono">
                No players ranked yet.
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

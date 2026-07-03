import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import { db, playersTable } from "@workspace/db";
import { GetLeaderboardResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/leaderboard", async (_req, res): Promise<void> => {
  const players = await db
    .select()
    .from(playersTable)
    .orderBy(desc(playersTable.wins))
    .limit(50);

  res.json(
    GetLeaderboardResponse.parse(
      players.map((p) => ({
        ...p,
        gamesPlayed: p.wins + p.losses,
      })),
    ),
  );
});

export default router;

import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, playersTable, matchesTable } from "@workspace/db";
import {
  RegisterPlayerBody,
  GetPlayerParams,
  GetPlayerResponse,
  GetPlayerMatchesParams,
  GetPlayerMatchesResponse,
  RegisterPlayerResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/players/register", async (req, res): Promise<void> => {
  const parsed = RegisterPlayerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { username, deviceId } = parsed.data;

  const [existing] = await db
    .select()
    .from(playersTable)
    .where(eq(playersTable.deviceId, deviceId));

  if (existing) {
    res.json(
      RegisterPlayerResponse.parse({
        ...existing,
        gamesPlayed: existing.wins + existing.losses,
      }),
    );
    return;
  }

  const [player] = await db
    .insert(playersTable)
    .values({ username, deviceId })
    .returning();

  if (!player) {
    res.status(500).json({ error: "Failed to create player" });
    return;
  }

  res.json(
    RegisterPlayerResponse.parse({
      ...player,
      gamesPlayed: player.wins + player.losses,
    }),
  );
});

router.get("/players/:id", async (req, res): Promise<void> => {
  const params = GetPlayerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [player] = await db
    .select()
    .from(playersTable)
    .where(eq(playersTable.id, params.data.id));

  if (!player) {
    res.status(404).json({ error: "Player not found" });
    return;
  }

  res.json(
    GetPlayerResponse.parse({
      ...player,
      gamesPlayed: player.wins + player.losses,
    }),
  );
});

router.get("/players/:id/matches", async (req, res): Promise<void> => {
  const params = GetPlayerMatchesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const playerId = params.data.id;

  const matches = await db
    .select()
    .from(matchesTable)
    .where(eq(matchesTable.playerOneId, playerId))
    .orderBy(desc(matchesTable.createdAt))
    .limit(20);

  const matches2 = await db
    .select()
    .from(matchesTable)
    .where(eq(matchesTable.playerTwoId, playerId))
    .orderBy(desc(matchesTable.createdAt))
    .limit(20);

  const allMatches = [...matches, ...matches2]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 20);

  const opponentIds = allMatches.map((m) =>
    m.playerOneId === playerId ? m.playerTwoId : m.playerOneId,
  );

  const opponents =
    opponentIds.length > 0
      ? await db.select().from(playersTable)
      : [];

  const opponentMap = new Map(opponents.map((o) => [o.id, o.username]));

  const result = allMatches.map((m) => {
    const isPlayerOne = m.playerOneId === playerId;
    const opponentId = isPlayerOne ? m.playerTwoId : m.playerOneId;
    const playerScore = isPlayerOne ? m.playerOneScore : m.playerTwoScore;
    const opponentScore = isPlayerOne ? m.playerTwoScore : m.playerOneScore;

    return {
      id: m.id,
      opponentUsername: opponentMap.get(opponentId) ?? "Unknown",
      result: m.winnerId === playerId ? "win" : "loss",
      playerScore,
      opponentScore,
      createdAt: m.createdAt,
    };
  });

  res.json(GetPlayerMatchesResponse.parse(result));
});

export default router;

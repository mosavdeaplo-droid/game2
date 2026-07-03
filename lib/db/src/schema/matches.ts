import { pgTable, text, integer, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { playersTable } from "./players";

export const matchesTable = pgTable("matches", {
  id: uuid("id").primaryKey().defaultRandom(),
  playerOneId: uuid("player_one_id")
    .notNull()
    .references(() => playersTable.id),
  playerTwoId: uuid("player_two_id")
    .notNull()
    .references(() => playersTable.id),
  winnerId: uuid("winner_id").references(() => playersTable.id),
  playerOneScore: integer("player_one_score").notNull().default(0),
  playerTwoScore: integer("player_two_score").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMatchSchema = createInsertSchema(matchesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertMatch = z.infer<typeof insertMatchSchema>;
export type Match = typeof matchesTable.$inferSelect;

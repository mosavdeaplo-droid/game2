import { pgTable, text, integer, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const playersTable = pgTable("players", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull(),
  deviceId: text("device_id").notNull().unique(),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  coins: integer("coins").notNull().default(100),
  rank: text("rank").notNull().default("Bronze"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPlayerSchema = createInsertSchema(playersTable).omit({
  id: true,
  createdAt: true,
});
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type Player = typeof playersTable.$inferSelect;

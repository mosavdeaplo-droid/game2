export type Rank = "Bronze" | "Silver" | "Gold" | "Platinum" | "Diamond";

export function computeRank(wins: number): Rank {
  if (wins >= 50) return "Diamond";
  if (wins >= 25) return "Platinum";
  if (wins >= 10) return "Gold";
  if (wins >= 3) return "Silver";
  return "Bronze";
}

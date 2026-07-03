import { Router, type IRouter } from "express";
import healthRouter from "./health";
import playersRouter from "./players";
import leaderboardRouter from "./leaderboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(playersRouter);
router.use(leaderboardRouter);

export default router;

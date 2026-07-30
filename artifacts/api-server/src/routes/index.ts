import { Router, type IRouter } from "express";
import healthRouter from "./health";
import broadcastRouter from "./broadcast";

const router: IRouter = Router();

router.use(healthRouter);
router.use(broadcastRouter);

export default router;

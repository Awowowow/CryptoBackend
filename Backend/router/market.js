import express from "express";
import { getOverview } from "../controllers/market.controller.js";
import { marketReadRateLimiter } from "../middleware/rate-limiters/index.js";

const marketRouter = express.Router();

marketRouter.get("/overview",marketReadRateLimiter , getOverview);

export default marketRouter;
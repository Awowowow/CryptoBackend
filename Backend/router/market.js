import express from "express";
import { getOverview } from "../controllers/market.controller.js";

const marketRouter = express.Router();

marketRouter.get("/overview", getOverview);

export default marketRouter;
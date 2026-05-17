import express from "express";
import { getWalletBalance } from "../controllers/wallet.controller.js";
import authentication from "../middleware/authentication.js";

const walletRouter = express.Router();

walletRouter.get("/balances", authentication, getWalletBalance);

export default walletRouter;
import express from "express";
import { getDepositAddress, getWalletBalance } from "../controllers/wallet.controller.js";
import authentication from "../middleware/authentication.js";

const walletRouter = express.Router();

walletRouter.get("/balances", authentication, getWalletBalance);

walletRouter.get("/deposit-address/:assetSymbol", authentication, getDepositAddress)

export default walletRouter;
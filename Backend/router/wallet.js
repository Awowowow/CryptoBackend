import express from "express";
import { getDepositAddress, getWalletBalance, getWalletDeposits } from "../controllers/wallet.controller.js";
import authentication from "../middleware/authentication.js";

const walletRouter = express.Router();

walletRouter.get("/balances", authentication, getWalletBalance);

walletRouter.get("/deposits", authentication, getWalletDeposits)

walletRouter.get("/deposit-address/:assetSymbol", authentication, getDepositAddress)

export default walletRouter;
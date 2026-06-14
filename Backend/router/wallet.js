import express from "express";
import { getDepositAddress, getWalletBalance, getWalletDeposits } from "../controllers/wallet.controller.js";
import authentication from "../middleware/authentication.js";
import { createWithdrawal, failWithdrawal, getWithdrawalById, getWithdrawals } from "../controllers/withdrawal.controller.js";

const walletRouter = express.Router();

walletRouter.get("/balances", authentication, getWalletBalance);

walletRouter.get("/deposits", authentication, getWalletDeposits)

walletRouter.get("/deposit-address/:assetSymbol", authentication, getDepositAddress)

walletRouter.get("/withdrawals", authentication, getWithdrawals );

walletRouter.get("/withdrawals/:withdrawalId", authentication, getWithdrawalById);

walletRouter.post("/withdrawals", authentication, createWithdrawal)

walletRouter.post("/withdrawals/:withdrawalId/fail",authentication,failWithdrawal);


export default walletRouter;
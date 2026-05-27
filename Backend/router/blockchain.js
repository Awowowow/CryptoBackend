import express from "express";
import { getBlockChainHealth, scanNativeEthDepositRange } from "../controllers/blockchain.controller.js";


const blockchainRouter = express.Router();

blockchainRouter.get("/health", getBlockChainHealth);

blockchainRouter.post("/scan/native-eth", scanNativeEthDepositRange);


export default blockchainRouter;
import { getOrCreateDepositAddress } from "../services/wallet-ledger-service/depositAddress.service.js";
import { getUserWalletBalance } from "../services/wallet-ledger-service/wallet.service.js";
import asyncWrapper from "../utils/asyncWrapper.js";

const getWalletBalance = asyncWrapper(async (req, res) => {
    const userId = req.user.userId;

    const balance = await getUserWalletBalance(userId);

    res.status(200).json({
        success: true,
        message: "Wallet balance fetched successfully",
        data: balance,
    }); 
});

const getDepositAddress = asyncWrapper(async (req,res) =>{
    const userId = req.user.userId;
    const assetSymbol = req.parmas;

    const depositAddress = await getOrCreateDepositAddress({
        userId,
        assetSymbol
    });

    req.status(200).json({
        success: true,
        message: "Deposit address fetched successfully",
        data: depositAddress,
    })
})

export {getWalletBalance}
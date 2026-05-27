import { listUserDeposits } from "../services/wallet-ledger-service/deposit.service.js";
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
    const { assetSymbol } = req.params;

    const depositAddress = await getOrCreateDepositAddress({
        userId,
        assetSymbol
    });

    res.status(200).json({
        success: true,
        message: "Deposit address fetched successfully",
        data: depositAddress,
    })
})

const getWalletDeposits = asyncWrapper(async (req,res) =>{
    const userId = req.user.userId;
    
    const deposits = await listUserDeposits({userId});

    res.status(200).json({
        success: true,
        message: "Wallet deposits fetched successfully",
        data: deposits,
      });
})

export {getWalletBalance,getDepositAddress, getWalletDeposits}

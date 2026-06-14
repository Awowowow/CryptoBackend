import { createWithdrawalRequest,failWithdrawalAndUnlockFunds, getUserWithdrawals, getUserWithdrawalsById } from "../services/wallet-ledger-service/withdrawal.service.js";
import AppError from "../utils/AppError.js";
import asyncWrapper from "../utils/asyncWrapper.js";

const createWithdrawal = asyncWrapper(async(req ,res) => {
    const userId = req.user.userId;

    if(!userId){
        throw new AppError("Authenticated user is required", 401);  
    }

    const {
        assetSymbol,
        networkCode,
        amount,
        destinationAddress,
        destinationMemo,
        idempotencyKey: bodyIdempotencyKey,
    } = req.body;

    const headerIdempotencyKey = req.header("Idempotency-Key");
    const idempotencyKey = headerIdempotencyKey || bodyIdempotencyKey;

    const withdrawal = await createWithdrawalRequest({
        userId,
        assetSymbol,
        networkCode,
        amount,
        destinationAddress,
        destinationMemo,
        idempotencyKey,
    })

    return res.status(201).json({
        success: true,
        message: "Withdrawal request created successfully",
        data: withdrawal,
    });
});

const failWithdrawal = asyncWrapper(async (req, res) => {
    const { withdrawalId } = req.params;
    const { reason } = req.body;
  
    const withdrawal = await failWithdrawalAndUnlockFunds({
      withdrawalId,
      reason: reason || "Withdrawal failed manually",
    });
  
    return res.status(200).json({
      success: true,
      message: "Withdrawal failed and funds unlocked successfully",
      data: withdrawal,
    });
  });

const getWithdrawals = asyncWrapper(async(req, res) =>{
    const userId = req.user.userId;

    if(!userId){
        throw new AppError("Authenticated user is required", 401);  
    }
    const withdrawals = await getUserWithdrawals({
        userId
    });

    return res.status(200).json({
        success: true,
        message: "User withdrawals fetched successfully",
        data: withdrawals,
    })
})

const getWithdrawalById = asyncWrapper(async(req, res) => {
    const userId = req.user.userId;
    const {withdrawalId} = req.params;

    if(!userId){
        throw new AppError("Authenticated user is required", 401);  
    };

    const withdrawal = await getUserWithdrawalsById({
        userId,
        withdrawalId,
    });

    return res.status(200).json({
        success: true,
        message: "Withdrawal details fetched successfully",
        data: withdrawal,
    });
})

export { createWithdrawal, failWithdrawal, getWithdrawals, getWithdrawalById };
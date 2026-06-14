import { WithdrawalStatus,CustodyProviderType } from "@prisma/client";
import prisma from "../../config/prisma.js";
import { parseUnits } from "ethers";
import { sendCustodyWithdrawal } from "../custody-service/custodyProvider.service.js";
import { failWithdrawalAndUnlockFunds } from "./withdrawal.service.js";

const toEthBaseUnits = ({ amount, decimals }) => {
    const normalizedAmount =
      typeof amount?.toString === "function" ? amount.toString() : String(amount);
  
    return parseUnits(normalizedAmount, decimals).toString();
  };

const processApprovedWithdrawal = async ({ withdrawalId }) => {
  const withdrawal = await prisma.withdrawal.findUnique({
    where: {
      id: withdrawalId,
    },
    include:{
        asset: true,
        network: true,
    },
  });

  if (!withdrawal) {
    throw new Error("Withdrawal not found");
  }

  if (withdrawal.status !== WithdrawalStatus.APPROVED) {
    return {
      skipped: true,
      reason: `Withdrawal status is ${withdrawal.status}`,
      withdrawalId: withdrawal.id,
    };
  }

  const processingWithdrawal = await prisma.withdrawal.update({
    where: {
      id: withdrawal.id,
    },
    data: {
      status: WithdrawalStatus.PROCESSING,
      processingAt: new Date(), 
    },
  });

  try {
    const amountBaseUnits = toEthBaseUnits({
      amount: processingWithdrawal.amount,
      decimals: withdrawal.asset.decimals,
    });
  
    const custodyTransfer = await sendCustodyWithdrawal({
      provider: CustodyProviderType.BITGO,
      networkCode: withdrawal.network.code,
      address: withdrawal.destinationAddress,
      amountBaseUnits,
      comment: `CryptoEx withdrawal ${withdrawal.id}`,
    });
  
    const submittedWithdrawal = await prisma.withdrawal.update({
      where: {
        id: withdrawal.id,
      },
      data: {
        status: WithdrawalStatus.SUBMITTED,
        submittedAt: new Date(),
        providerTransferId: custodyTransfer.id ?? null,
        txHash: custodyTransfer.txid ?? custodyTransfer.txHash ?? null,
      },
    });
  
    return {
      skipped: false,
      withdrawalId: submittedWithdrawal.id,
      status: submittedWithdrawal.status,
      providerTransferId: submittedWithdrawal.providerTransferId,
      txHash: submittedWithdrawal.txHash,
    };
  } catch (error) {
    await failWithdrawalAndUnlockFunds({
      withdrawalId: withdrawal.id,
      reason: error instanceof Error ? error.message : "Withdrawal submission failed",
    });
  
    throw error;
  }
};



export { processApprovedWithdrawal };
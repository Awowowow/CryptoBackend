import { WithdrawalStatus, CustodyProviderType } from "@prisma/client";
import prisma from "../../config/prisma.js";
import { parseUnits } from "ethers";
import { getCustodyTransfer, sendCustodyWithdrawal } from "../custody-service/custodyProvider.service.js";
import { createWithdrawalAuditLog, failWithdrawalAndUnlockFunds } from "./withdrawal.service.js";
import { enqueueSubmittedWithdrawalFinalizationJob } from "../../jobs/withdrawalJob.service.js";
import { createWithdrawalDomainEvent, WithdrawalDomainEventType } from "../event-service/withdrawalDomainEvent.service.js";

const WITHDRAWAL_FINALIZER_RECHECK_DELAY_MS = 30_000;
const WITHDRAWAL_FINALIZER_COMPLETED_STATUSES = new Set([
  WithdrawalStatus.COMPLETED,
  WithdrawalStatus.FAILED,
  WithdrawalStatus.REJECTED,
  WithdrawalStatus.CANCELLED,
]);

const toAssetBaseUnits = ({ amount, decimals }) => {
  const normalizedAmount =
    typeof amount?.toString === "function"
      ? amount.toString()
      : String(amount);

  return parseUnits(normalizedAmount, decimals).toString();
};

const getBitGoWithdrawalResultIds = (bitgoResult) => {
    const transfer = bitgoResult.transfer ?? null;
    const txRequest = bitgoResult.txRequest ?? null;
    const pendingApproval = bitgoResult.pendingApproval ?? null;
  
    return {
      providerTransferId:
        transfer?.id ??
        bitgoResult.transferId ??
        bitgoResult.id ??
        null,
  
      providerTxRequestId:
        txRequest?.txRequestId ??
        pendingApproval?.txRequestId ??
        pendingApproval?.info?.transactionRequestFull?.txRequestId ??
        null,
  
      providerPendingApprovalId:
        pendingApproval?.id ??
        txRequest?.pendingApprovalId ??
        null,
  
      providerState:
        txRequest?.state ??
        pendingApproval?.state ??
        bitgoResult.status ??
        null,
  
      txHash:
        transfer?.txid ??
        transfer?.txHash ??
        transfer?.normalizedTxHash ??
        bitgoResult.txid ??
        bitgoResult.txHash ??
        null,
    };
};

const processApprovedWithdrawal = async ({ withdrawalId }) => {
  const withdrawal = await prisma.withdrawal.findUnique({
    where: {
      id: withdrawalId,
    },
    include: {
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
    const amountBaseUnits = toAssetBaseUnits({
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

      
      const {
        providerTransferId,
        providerTxRequestId,
        providerPendingApprovalId,
        providerState,
        txHash,
      } = getBitGoWithdrawalResultIds(custodyTransfer);
    

    const submittedWithdrawal = await prisma.withdrawal.update({
      where: {
        id: withdrawal.id,
      },
      data: {
        status: WithdrawalStatus.SUBMITTED,
        submittedAt: new Date(),
        providerTransferId,
        providerTxRequestId,
        providerPendingApprovalId,
        providerState,
        txHash,
      },
    })

    await createWithdrawalDomainEvent({
      eventType: WithdrawalDomainEventType.SUBMITTED,
      withdrawal: submittedWithdrawal,
      payload: {
        providerTransferId,
        providerTxRequestId,
        providerPendingApprovalId,
        providerState,
        txHash,
      },
    });


    await enqueueSubmittedWithdrawalFinalizationJob({
        withdrawalId: submittedWithdrawal.id
    })

    return {
        skipped: false,
        withdrawalId: submittedWithdrawal.id,
        status: submittedWithdrawal.status,
        providerTransferId: submittedWithdrawal.providerTransferId,
        providerTxRequestId: submittedWithdrawal.providerTxRequestId,
        providerPendingApprovalId: submittedWithdrawal.providerPendingApprovalId,
        providerState: submittedWithdrawal.providerState,
        txHash: submittedWithdrawal.txHash,
      };
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "Withdrawal submission failed";
    
      const failedWithdrawal = await failWithdrawalAndUnlockFunds({
        withdrawalId: withdrawal.id,
        reason,
      });
    
      await createWithdrawalDomainEvent({
        eventType: WithdrawalDomainEventType.FAILED,
        withdrawal: {
          ...withdrawal,
          status: WithdrawalStatus.FAILED,
          failureReason: reason,
        },
        payload: {
          reason,
          failedWithdrawal,
        },
      });
    
      throw error;
    }
};

const getNextWithdrawalStatusFromTransfer = ({ transfer, withdrawal }) => {
    const state = String(transfer.state || "").toLowerCase();
    const confirmations = Number(transfer.confirmations || 0);
    const requiredConfirmations = Number(withdrawal.requiredConfirmations || 0);
    const hasTxHash = Boolean(transfer.txid || transfer.txHash || withdrawal.txHash);
  
    if (state === "failed" || state === "rejected" || state === "canceled") {
      return WithdrawalStatus.FAILED;
    }
  
    if (
      state === "confirmed" &&
      (requiredConfirmations === 0 || confirmations >= requiredConfirmations)
    ) {
      return WithdrawalStatus.COMPLETED;
    }
  
    if (state === "confirmed") {
      return WithdrawalStatus.CONFIRMED;
    }
  
    if (hasTxHash) {
      return WithdrawalStatus.BROADCASTED;
    }
  
    return withdrawal.status;
  };

  const scheduleWithdrawalFinalizerIfNeeded = async ({ withdrawal }) => {
    if (WITHDRAWAL_FINALIZER_COMPLETED_STATUSES.has(withdrawal.status)) {
      return {
        scheduled: false,
        reason: `Withdrawal status is terminal: ${withdrawal.status}`,
      };
    }
  
    await enqueueSubmittedWithdrawalFinalizationJob({
      withdrawalId: withdrawal.id,
      delayMs: WITHDRAWAL_FINALIZER_RECHECK_DELAY_MS,
    });
  
    return {
      scheduled: true,
      delayMs: WITHDRAWAL_FINALIZER_RECHECK_DELAY_MS,
    };
  };

  const getWithdrawalDomainEventTypeForStatus = (status) => {
    if (status === WithdrawalStatus.BROADCASTED) {
      return WithdrawalDomainEventType.BROADCASTED;
    }
  
    if (status === WithdrawalStatus.CONFIRMED) {
      return WithdrawalDomainEventType.CONFIRMED;
    }
  
    if (status === WithdrawalStatus.COMPLETED) {
      return WithdrawalDomainEventType.COMPLETED;
    }
  
    if (status === WithdrawalStatus.FAILED) {
      return WithdrawalDomainEventType.FAILED;
    }
  
    return null;
  };
  
  const finalizeSubmittedWithdrawal = async ({ withdrawalId }) => {
    const withdrawal = await prisma.withdrawal.findUnique({
      where: {
        id: withdrawalId,
      },
      include: {
        asset: true,
        network: true,
      },
    });
  
    if (!withdrawal) {
      throw new Error("Withdrawal not found");
    }
  
    const finalizableStatuses = new Set([
      WithdrawalStatus.SUBMITTED,
      WithdrawalStatus.BROADCASTED,
      WithdrawalStatus.CONFIRMED,
    ]);
  
    if (!finalizableStatuses.has(withdrawal.status)) {
      return {
        skipped: true,
        reason: `Withdrawal status is ${withdrawal.status}`,
        withdrawalId: withdrawal.id,
      };
    }
  
    if (!withdrawal.providerTransferId && withdrawal.providerTxRequestId) {
        await createWithdrawalAuditLog({
          withdrawalId: withdrawal.id,
          action: "WITHDRAWAL_WAITING_FOR_PROVIDER_APPROVAL",
          fromStatus: withdrawal.status,
          toStatus: withdrawal.status,
          metadata: {
            providerTxRequestId: withdrawal.providerTxRequestId,
            providerPendingApprovalId: withdrawal.providerPendingApprovalId,
            providerState: withdrawal.providerState,
          },
        });

        const followUp = await scheduleWithdrawalFinalizerIfNeeded({
            withdrawal,
          });
      
        return {
          skipped: true,
          reason: "Withdrawal is waiting for BitGo approval/signature",
          withdrawalId: withdrawal.id,
          status: withdrawal.status,
          providerTxRequestId: withdrawal.providerTxRequestId,
          providerPendingApprovalId: withdrawal.providerPendingApprovalId,
          providerState: withdrawal.providerState,
          followUp
        };
      }
      
      if (!withdrawal.providerTransferId) {
        throw new Error("Withdrawal provider transfer id is missing");
      }
  
    const transfer = await getCustodyTransfer({
      provider: CustodyProviderType.BITGO,
      networkCode: withdrawal.network.code,
      transferId: withdrawal.providerTransferId,
    });
  
    const confirmations = Number(transfer.confirmations || 0);
    const txHash = transfer.txid || transfer.txHash || withdrawal.txHash || null;
  
    const nextStatus = getNextWithdrawalStatusFromTransfer({
      transfer,
      withdrawal,
    });
  
    const updateData = {
      confirmations,
      txHash,
    };
  
      if (nextStatus !== withdrawal.status) {
      updateData.status = nextStatus;
  
      if (nextStatus === WithdrawalStatus.BROADCASTED && !withdrawal.broadcastedAt) {
        updateData.broadcastedAt = new Date();
      }
  
      if (nextStatus === WithdrawalStatus.CONFIRMED && !withdrawal.confirmedAt) {
        updateData.confirmedAt = new Date();
      }
  
      if (nextStatus === WithdrawalStatus.COMPLETED && !withdrawal.completedAt) {
        updateData.confirmedAt = withdrawal.confirmedAt || new Date();
        updateData.completedAt = new Date();
      }
  
      if (nextStatus === WithdrawalStatus.FAILED && !withdrawal.failedAt) {
        updateData.failedAt = new Date();
        updateData.failureReason = transfer.error || transfer.comment || "Custody transfer failed";
      }
    }
  
    const updatedWithdrawal = await prisma.withdrawal.update({
      where: {
        id: withdrawal.id,
      },
      data: updateData,
    });

    const domainEventType = getWithdrawalDomainEventTypeForStatus(
      updatedWithdrawal.status
    );
    
    if (nextStatus !== withdrawal.status && domainEventType) {
      await createWithdrawalDomainEvent({
        eventType: domainEventType,
        withdrawal: updatedWithdrawal,
        payload: {
          previousStatus: withdrawal.status,
          providerTransferId: withdrawal.providerTransferId,
          providerState: transfer.state ?? null,
          confirmations,
          txHash,
        },
      });
    }

    const followUp = await scheduleWithdrawalFinalizerIfNeeded({
        withdrawal: updatedWithdrawal,
      });
  
    await createWithdrawalAuditLog({
      withdrawalId: withdrawal.id,
      action:
        nextStatus === withdrawal.status
          ? "WITHDRAWAL_FINALIZATION_CHECKED"
          : "WITHDRAWAL_STATUS_UPDATED",
      fromStatus: withdrawal.status,
      toStatus: updatedWithdrawal.status,
      metadata: {
        providerTransferId: withdrawal.providerTransferId,
        providerState: transfer.state ?? null,
        confirmations,
        txHash,
      },
    });
  
    return {
      skipped: false,
      withdrawalId: updatedWithdrawal.id,
      previousStatus: withdrawal.status,
      status: updatedWithdrawal.status,
      providerTransferId: withdrawal.providerTransferId,
      txHash: updatedWithdrawal.txHash,
      confirmations: updatedWithdrawal.confirmations,
      followUp,
    };
  };

export { processApprovedWithdrawal, finalizeSubmittedWithdrawal };

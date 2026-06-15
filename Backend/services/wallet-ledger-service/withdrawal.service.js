import {
  LedgerTransactionType,
  WalletAccountType,
  WithdrawalStatus,
} from "@prisma/client";
import prisma from "../../config/prisma.js";
import AppError from "../../utils/AppError.js";
import { toDecimal } from "../../utils/decimals.js";
import { enqueueApprovedWithdrawalJob } from "../../jobs/withdrawalJob.service.js";
import { postLedgerTransaction } from "./ledger.service.js";
import { getOrCreateUserWalletAccounts } from "./walletAccount.service.js";
import { createWithdrawalDomainEvent, WithdrawalDomainEventType } from "../event-service/withdrawalDomainEvent.service.js";

// Keep this configurable so review thresholds can change without a code deploy.
const getManualReviewThreshold = () => {
  const rawThreshold = process.env.WITHDRAWAL_MANUAL_REVIEW_THRESHOLD;

  if (!rawThreshold) {
    return null;
  }

  const threshold = toDecimal(rawThreshold, "Withdrawal manual review threshold");

  if (threshold.isNegative()) {
    throw new AppError("Withdrawal manual review threshold cannot be negative", 500);
  }

  return threshold;
};

const shouldRequireManualReview = ({ amount }) => {
  const threshold = getManualReviewThreshold();

  if (!threshold) {
    return {
      requiresManualReview: false,
      riskScore: 0,
      riskReason: null,
    };
  }

  if (amount.greaterThanOrEqualTo(threshold)) {
    return {
      requiresManualReview: true,
      riskScore: 70,
      riskReason: "Withdrawal amount meets or exceeds manual review threshold",
    };
  }

  return {
    requiresManualReview: false,
    riskScore: 0,
    riskReason: null,
  };
};

// Store a compact audit trail for admin review, debugging, and future reconciliation.
const createWithdrawalAuditLog = async ({
  withdrawalId,
  actorUserId = null,
  action,
  fromStatus = null,
  toStatus = null,
  reason = null,
  metadata = null,
}) => {
  return prisma.withdrawalAuditLog.create({
    data: {
      withdrawalId,
      actorUserId,
      action,
      fromStatus,
      toStatus,
      reason,
      metadata,
    },
  });
};

// Return money values as strings so JSON responses do not lose decimal precision.
const formatWithdrawal = (withdrawal) => {
  return {
    id: withdrawal.id,
    asset: {
      id: withdrawal.asset.id,
      symbol: withdrawal.asset.symbol,
      name: withdrawal.asset.name,
      decimals: withdrawal.asset.decimals,
    },
    network: {
      id: withdrawal.network.id,
      code: withdrawal.network.code,
      name: withdrawal.network.name,
    },
    destinationAddress: withdrawal.destinationAddress,
    destinationMemo: withdrawal.destinationMemo,
    amount: withdrawal.amount.toString(),
    feeAmount: withdrawal.feeAmount.toString(),
    totalAmount: withdrawal.totalAmount.toString(),
    status: withdrawal.status,
    requiresManualReview: withdrawal.requiresManualReview,
    riskScore: withdrawal.riskScore,
    riskReason: withdrawal.riskReason,
    providerTransferId: withdrawal.providerTransferId,
    providerTxRequestId: withdrawal.providerTxRequestId,
    providerPendingApprovalId: withdrawal.providerPendingApprovalId,
    providerState: withdrawal.providerState,
    txHash: withdrawal.txHash,
    requestedAt: withdrawal.requestedAt,
    completedAt: withdrawal.completedAt,
    auditLogs: withdrawal.auditLogs?.map((auditLog) => ({
      id: auditLog.id,
      action: auditLog.action,
      fromStatus: auditLog.fromStatus,
      toStatus: auditLog.toStatus,
      reason: auditLog.reason,
      metadata: auditLog.metadata,
      createdAt: auditLog.createdAt,
    })) ?? undefined,
  };
};

const createWithdrawalRequest = async ({
  userId,
  assetSymbol,
  networkCode,
  amount,
  destinationAddress,
  destinationMemo = null,
  idempotencyKey,
}) => {
  if (!userId || typeof userId !== "string") {
    throw new AppError("User id is required", 400);
  }

  if (!assetSymbol || typeof assetSymbol !== "string") {
    throw new AppError("Asset symbol is required", 400);
  }

  if (!networkCode || typeof networkCode !== "string") {
    throw new AppError("Network code is required", 400);
  }

  if (!destinationAddress || typeof destinationAddress !== "string") {
    throw new AppError("Withdrawal destination address is required", 400);
  }

  if (!idempotencyKey || typeof idempotencyKey !== "string") {
    throw new AppError("Withdrawal idempotency key is required", 400);
  }

  const normalizedAssetSymbol = assetSymbol.trim().toUpperCase();
  const normalizedNetworkCode = networkCode.trim().toUpperCase();
  const normalizedDestinationAddress = destinationAddress.trim();
  const normalizedDestinationMemo =
    typeof destinationMemo === "string" && destinationMemo.trim()
      ? destinationMemo.trim()
      : null;

  if (!normalizedAssetSymbol) {
    throw new AppError("Asset symbol is required", 400);
  }

  if (!normalizedNetworkCode) {
    throw new AppError("Network code is required", 400);
  }

  if (!normalizedDestinationAddress) {
    throw new AppError("Withdrawal destination address is required", 400);
  }

  const normalizedAmount = toDecimal(amount, "Withdrawal amount");

  if (!normalizedAmount.isPositive()) {
    throw new AppError("Withdrawal amount must be greater than zero", 400);
  }

  // Idempotency prevents duplicate withdrawals when clients retry or users double-click.
  const existingWithdrawal = await prisma.withdrawal.findUnique({
    where: {
      idempotencyKey,
    },
    include: {
      asset: true,
      network: true,
    },
  });

  if (existingWithdrawal) {
    return formatWithdrawal(existingWithdrawal);
  }

  const assetNetwork = await prisma.assetNetwork.findFirst({
    where: {
      asset: {
        symbol: normalizedAssetSymbol,
        isActive: true,
      },
      network: {
        code: normalizedNetworkCode,
        isActive: true,
      },
      withdrawalEnabled: true,
    },
    include: {
      asset: true,
      network: true,
    },
  });

  if (!assetNetwork) {
    throw new AppError("Withdrawals are not supported for this asset network", 404);
  }

  const userWalletAccounts = await getOrCreateUserWalletAccounts({
    userId,
    assetId: assetNetwork.assetId,
  });

  const availableWalletAccount = userWalletAccounts.find(
    (walletAccount) => walletAccount.type === WalletAccountType.AVAILABLE
  );

  const lockedWalletAccount = userWalletAccounts.find(
    (walletAccount) => walletAccount.type === WalletAccountType.LOCKED
  );

  if (!availableWalletAccount || !lockedWalletAccount) {
    throw new AppError("User wallet accounts are missing", 500);
  }

  const feeAmount = toDecimal(0, "Withdrawal fee amount");
  const totalAmount = normalizedAmount.plus(feeAmount);

  const reviewDecision = shouldRequireManualReview({
    amount: normalizedAmount,
  });

  const nextStatus = reviewDecision.requiresManualReview
    ? WithdrawalStatus.PENDING_REVIEW
    : WithdrawalStatus.APPROVED;

  // Create the withdrawal first so the ledger transaction can reference a stable withdrawal id.
  const withdrawal = await prisma.withdrawal.create({
    data: {
      userId,
      assetId: assetNetwork.assetId,
      assetNetworkId: assetNetwork.id,
      networkId: assetNetwork.networkId,
      destinationAddress: normalizedDestinationAddress,
      destinationMemo: normalizedDestinationMemo,
      amount: normalizedAmount,
      feeAmount,
      totalAmount,
      idempotencyKey,
      status: WithdrawalStatus.REQUESTED,
      riskScore: reviewDecision.riskScore,
      riskReason: reviewDecision.riskReason,
      requiresManualReview: reviewDecision.requiresManualReview,
    },
    include: {
      asset: true,
      network: true,
    },
  });

  await createWithdrawalAuditLog({
    withdrawalId: withdrawal.id,
    actorUserId: userId,
    action: "CREATE_WITHDRAWAL_REQUEST",
    toStatus: WithdrawalStatus.REQUESTED,
    metadata: {
      assetSymbol: normalizedAssetSymbol,
      networkCode: normalizedNetworkCode,
    },
  });

  await createWithdrawalDomainEvent({
    eventType: WithdrawalDomainEventType.REQUESTED,
    withdrawal,
    payload: {
      assetSymbol: normalizedAssetSymbol,
      networkCode: normalizedNetworkCode,
    },
  });

  await createWithdrawalAuditLog({
    withdrawalId: withdrawal.id,
    actorUserId: userId,
    action: "SECURITY_CHECK_PASSED",
    fromStatus: WithdrawalStatus.REQUESTED,
    toStatus: WithdrawalStatus.SECURITY_CHECKED,
  });

  // Move funds from AVAILABLE to LOCKED; the ledger service enforces balance safety and double-entry accounting.
  await postLedgerTransaction({
    type: LedgerTransactionType.FUNDS_LOCK,
    idempotencyKey: `withdrawal-lock:${withdrawal.id}`,
    referenceType: "WITHDRAWAL",
    referenceId: withdrawal.id,
    description: `Lock funds for withdrawal ${withdrawal.id}`,
    entries: [
      {
        walletAccountId: availableWalletAccount.id,
        assetId: assetNetwork.assetId,
        amount: totalAmount.negated(),
      },
      {
        walletAccountId: lockedWalletAccount.id,
        assetId: assetNetwork.assetId,
        amount: totalAmount,
      },
    ],
  });

  await createWithdrawalAuditLog({
    withdrawalId: withdrawal.id,
    action: "LOCK_WITHDRAWAL_FUNDS",
    fromStatus: WithdrawalStatus.SECURITY_CHECKED,
    toStatus: WithdrawalStatus.FUNDS_LOCKED,
  });

  await createWithdrawalDomainEvent({
    eventType: WithdrawalDomainEventType.FUNDS_LOCKED,
    withdrawal: {
      ...withdrawal,
      status: WithdrawalStatus.FUNDS_LOCKED,
    },
  });

  // Only mark the withdrawal approved/reviewable after funds are successfully locked.
  const updatedWithdrawal = await prisma.withdrawal.update({
    where: {
      id: withdrawal.id,
    },
    data: {
      status: nextStatus,
      securityCheckedAt: new Date(),
      fundsLockedAt: new Date(),
      reviewRequestedAt: reviewDecision.requiresManualReview ? new Date() : null,
      approvedAt: reviewDecision.requiresManualReview ? null : new Date(),
    },
    include: {
      asset: true,
      network: true,
    },
  });

  await createWithdrawalAuditLog({
    withdrawalId: withdrawal.id,
    action: reviewDecision.requiresManualReview
      ? "REQUEST_MANUAL_REVIEW"
      : "AUTO_APPROVE_WITHDRAWAL",
    fromStatus: WithdrawalStatus.FUNDS_LOCKED,
    toStatus: nextStatus,
    reason: reviewDecision.riskReason,
  });

  await createWithdrawalDomainEvent({
    eventType: reviewDecision.requiresManualReview
      ? WithdrawalDomainEventType.PENDING_REVIEW
      : WithdrawalDomainEventType.APPROVED,
    withdrawal: updatedWithdrawal,
    payload: {
      riskScore: updatedWithdrawal.riskScore,
      riskReason: updatedWithdrawal.riskReason,
      requiresManualReview: updatedWithdrawal.requiresManualReview,
    },
  });

  if (updatedWithdrawal.status === WithdrawalStatus.APPROVED) {
    await enqueueApprovedWithdrawalJob({
      withdrawalId: updatedWithdrawal.id,
    });
  }

  return formatWithdrawal(updatedWithdrawal);
};

const unlockWithdrawalFunds = async ({ withdrawalId, reason = null }) => {
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
    throw new AppError("Withdrawal not found", 404);
  }

  const unsafeUnlockStatuses = new Set([
    WithdrawalStatus.SUBMITTED,
    WithdrawalStatus.BROADCASTED,
    WithdrawalStatus.CONFIRMED,
    WithdrawalStatus.COMPLETED,
  ]);

  if (unsafeUnlockStatuses.has(withdrawal.status)) {
    throw new AppError("Cannot unlock funds after withdrawal has been submitted", 409);
  }

  if (withdrawal.providerTransferId || withdrawal.txHash) {
    throw new AppError("Cannot unlock funds after custody transfer was created", 409);
  }

  const userWalletAccounts = await getOrCreateUserWalletAccounts({
    userId: withdrawal.userId,
    assetId: withdrawal.assetId,
  });

  const availableWalletAccount = userWalletAccounts.find(
    (walletAccount) => walletAccount.type === WalletAccountType.AVAILABLE
  );

  const lockedWalletAccount = userWalletAccounts.find(
    (walletAccount) => walletAccount.type === WalletAccountType.LOCKED
  );

  if (!availableWalletAccount || !lockedWalletAccount) {
    throw new AppError("User wallet accounts are missing", 500);
  }

  await postLedgerTransaction({
    type: LedgerTransactionType.FUNDS_UNLOCK,
    idempotencyKey: `withdrawal-unlock:${withdrawal.id}`,
    referenceType: "WITHDRAWAL",
    referenceId: withdrawal.id,
    description: `Unlock funds for withdrawal ${withdrawal.id}`,
    entries: [
      {
        walletAccountId: lockedWalletAccount.id,
        assetId: withdrawal.assetId,
        amount: withdrawal.totalAmount.negated(),
      },
      {
        walletAccountId: availableWalletAccount.id,
        assetId: withdrawal.assetId,
        amount: withdrawal.totalAmount,
      },
    ],
  });

  await createWithdrawalAuditLog({
    withdrawalId: withdrawal.id,
    action: "UNLOCK_WITHDRAWAL_FUNDS",
    reason,
  });

  return formatWithdrawal(withdrawal);
};

const failWithdrawalAndUnlockFunds = async ({
  withdrawalId,
  reason = "Withdrawal failed before submission",
}) => {
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
    throw new AppError("Withdrawal not found", 404);
  }

  if (withdrawal.status === WithdrawalStatus.COMPLETED) {
    throw new AppError("Completed withdrawal cannot be failed", 409);
  }

  await prisma.withdrawal.update({
    where: {
      id: withdrawal.id,
    },
    data: {
      status: WithdrawalStatus.FAILED,
      failedAt: new Date(),
      failureReason: reason,
    },
  });

  await createWithdrawalAuditLog({
    withdrawalId: withdrawal.id,
    action: "MARK_WITHDRAWAL_FAILED",
    fromStatus: withdrawal.status,
    toStatus: WithdrawalStatus.FAILED,
    reason,
  });

  const unlockedWithdrawal = await unlockWithdrawalFunds({
    withdrawalId: withdrawal.id,
    reason,
  });

  return unlockedWithdrawal;
};

const getUserWithdrawals = async ({userId}) => {
  if(!userId || typeof userId !== "string"){
    throw new AppError("User id is required", 400);
  }

  const withdrawal = await prisma.withdrawal.findMany({
    where:{
      userId,
    },
    orderBy:{
      requestedAt: "desc",
    },
    include:{
      asset: true,
      network: true,
    },
  });

  return withdrawal.map(formatWithdrawal);
};

const getUserWithdrawalsById = async({userId, withdrawalId}) =>{
  if(!userId || typeof userId !== "string"){
    throw new AppError("User id is required", 400);
  }

  if (!withdrawalId || typeof withdrawalId !== "string") {
    throw new AppError("Withdrawal id is required", 400);
  }

  const withdrawal = await prisma.withdrawal.findFirst({
    where:{
      id: withdrawalId,
      userId,
    },
    include:{
      asset: true,
      network: true,
      auditLogs:{
        orderBy:{
          createdAt: "asc",
        }
      }
    },
  });

  if(!withdrawal){
    throw new AppError("Withdrawal not found", 404);
  }

  return formatWithdrawal(withdrawal);
}

export {
  createWithdrawalRequest,
  unlockWithdrawalFunds,
  failWithdrawalAndUnlockFunds,
  getUserWithdrawals,
  getUserWithdrawalsById,
  createWithdrawalAuditLog
};
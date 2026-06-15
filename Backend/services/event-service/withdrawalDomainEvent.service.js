import { createDomainEventOutboxEntry } from "./domainEventOutbox.service.js";

const WithdrawalDomainEventType = Object.freeze({
    REQUESTED: "withdrawal.requested",
    FUNDS_LOCKED: "withdrawal.funds_locked",
    PENDING_REVIEW: "withdrawal.pending_review",
    APPROVED: "withdrawal.approved",
    SUBMITTED: "withdrawal.submitted",
    BROADCASTED: "withdrawal.broadcasted",
    CONFIRMED: "withdrawal.confirmed",
    COMPLETED: "withdrawal.completed",
    FAILED: "withdrawal.failed",
  });

const createWithdrawalDomainEvent = async ({
  eventType,
  withdrawal,
  payload = {},
}) => {
  return createDomainEventOutboxEntry({
    eventType,
    aggregateType: "Withdrawal",
    aggregateId: withdrawal.id,
    idempotencyKey: `${eventType}:${withdrawal.id}`,
    payload: {
      withdrawalId: withdrawal.id,
      userId: withdrawal.userId,
      assetId: withdrawal.assetId,
      networkId: withdrawal.networkId,
      status: withdrawal.status,
      amount: withdrawal.amount?.toString(),
      feeAmount: withdrawal.feeAmount?.toString(),
      totalAmount: withdrawal.totalAmount?.toString(),
      providerTransferId: withdrawal.providerTransferId,
      providerTxRequestId: withdrawal.providerTxRequestId,
      providerPendingApprovalId: withdrawal.providerPendingApprovalId,
      providerState: withdrawal.providerState,
      txHash: withdrawal.txHash,
      ...payload,
    },
  });
};

export {
  WithdrawalDomainEventType,
  createWithdrawalDomainEvent,
};
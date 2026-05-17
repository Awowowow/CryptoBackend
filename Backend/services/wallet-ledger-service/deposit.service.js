import {
  DepositStatus,
  LedgerTransactionType,
  WalletAccountType,
} from "@prisma/client";
import prisma from "../../config/prisma.js";
import { toDecimal } from "../../utils/decimal.js";
import AppError from "../../utils/appError.js";
import {
  getOrCreateUserWalletAccounts,
  getOrcreateSystemWalletAccount,
} from "./walletAccount.service.js";
import { postLedgerTransaction } from "./ledger.service.js";

const getDepositStatusFromConfirmations = ({
  confirmations,
  minConfirmations,
}) => {
  if (confirmations <= 0) {
    return DepositStatus.DETECTED;
  }

  if (confirmations < minConfirmations) {
    return DepositStatus.CONFIRMING;
  }

  return DepositStatus.CONFIRMED;
};

const recordDetectedDeposit = async ({
  networkCode,
  address,
  memo = null,
  txHash,
  eventIndex = 0,
  amount,
  confirmations = 0,
}) => {
  const normalizedNetworkCode = networkCode.trim().toUpperCase();
  const normalizedAddress = address.trim();

  if (!normalizedAddress) {
    throw new AppError("Deposit address is required", 400);
  }

  if (!txHash || typeof txHash !== "string") {
    throw new AppError("Transaction hash is required", 400);
  }

  if (!Number.isInteger(eventIndex) || eventIndex < 0) {
    throw new AppError("Event index must be a non-negative integer", 400);
  }

  if (!Number.isInteger(confirmations) || confirmations < 0) {
    throw new AppError("Confirmations must be a non-negative integer", 400);
  }

  const normalizedAmount = toDecimal(amount, "Deposit amount");

  if (!normalizedAmount.isPositive()) {
    throw new AppError("Deposit amount must be greater than zero", 400);
  }

  const depositAddress = await prisma.depositAddress.findFirst({
    where: {
      address: normalizedAddress,
      memo,
      network: {
        code: normalizedNetworkCode,
        isActive: true,
      },
      isActive: true,
    },
    include: {
      assetNetwork: {
        include: {
          asset: true,
          network: true,
        },
      },
    },
  });

  if (!depositAddress) {
    throw new AppError("Deposit address not found", 404);
  }

  if (!depositAddress.assetNetwork.depositEnabled) {
    throw new AppError("Deposits are disabled for this asset network", 409);
  }

  const status = getDepositStatusFromConfirmations({
    confirmations,
    minConfirmations: depositAddress.assetNetwork.minConfirmations,
  });

  const existingDeposit = await prisma.deposit.findUnique({
    where: {
      networkId_txHash_eventIndex: {
        networkId: depositAddress.networkId,
        txHash,
        eventIndex,
      },
    },
  });

  if (existingDeposit) {
    return existingDeposit;
  }

  const deposit = await prisma.deposit.create({
    data: {
      userId: depositAddress.userId,
      assetNetworkId: depositAddress.assetNetworkId,
      networkId: depositAddress.networkId,
      depositAddressId: depositAddress.id,
      txHash,
      eventIndex,
      amount: normalizedAmount,
      status,
      confirmations,
      confirmedAt: status === DepositStatus.CONFIRMED ? new Date() : null,
    },
  });

  return deposit;
};

const updateDepositConfirmations = async ({
  networkCode,
  txHash,
  eventIndex = 0,
  confirmations,
}) => {
  const normalizedNetworkCode = networkCode.trim().toUpperCase();

  if (!txHash || typeof txHash !== "string") {
    throw new AppError("Transaction hash is required", 400);
  }

  if (!Number.isInteger(eventIndex) || eventIndex < 0) {
    throw new AppError("Event index must be a non-negative integer", 400);
  }

  if (!Number.isInteger(confirmations) || confirmations < 0) {
    throw new AppError("Confirmations must be a non-negative integer", 400);
  }

  const deposit = await prisma.deposit.findFirst({
    where: {
      txHash,
      eventIndex,
      network: {
        code: normalizedNetworkCode,
      },
    },
    include: {
      assetNetwork: true,
    },
  });

  if (!deposit) {
    throw new AppError("Deposit not found", 404);
  }

  if (
    deposit.status === DepositStatus.CREDITED ||
    deposit.status === DepositStatus.REJECTED
  ) {
    return deposit;
  }

  const nextStatus = getDepositStatusFromConfirmations({
    confirmations,
    minConfirmations: deposit.assetNetwork.minConfirmations,
  });

  const updatedDeposit = await prisma.deposit.update({
    where: {
      id: deposit.id,
    },
    data: {
      confirmations,
      status: nextStatus,
      confirmedAt:
        nextStatus === DepositStatus.CONFIRMED
          ? deposit.confirmedAt ?? new Date()
          : null,
    },
  });

  return updatedDeposit;
};

const creditConfirmedDeposit = async ({ depositId }) => {
  const deposit = await prisma.deposit.findUnique({
    where: {
      id: depositId,
    },
    include: {
      assetNetwork: true,
    },
  });

  if (!deposit) {
    throw new AppError("Deposit not found", 404);
  }

  if (deposit.status === DepositStatus.CREDITED) {
    return deposit;
  }

  if (deposit.status !== DepositStatus.CONFIRMED) {
    throw new AppError("Only confirmed deposits can be credited", 409);
  }

  const userWalletAccounts = await getOrCreateUserWalletAccounts({
    userId: deposit.userId,
    assetId: deposit.assetNetwork.assetId,
  });

  const userAvailableAccount = userWalletAccounts.find(
    (account) => account.type === WalletAccountType.AVAILABLE
  );

  if (!userAvailableAccount) {
    throw new AppError("User available wallet account is missing", 500);
  }

  const custodyAccount = await getOrcreateSystemWalletAccount({
    assetId: deposit.assetNetwork.assetId,
    type: WalletAccountType.CUSTODY,
    label: "Main custody account",
  });

  await postLedgerTransaction({
    type: LedgerTransactionType.DEPOSIT,
    idempotencyKey: `deposit:${deposit.id}`,
    referenceType: "DEPOSIT",
    referenceId: deposit.id,
    description: `Blockchain deposit credit for ${deposit.txHash}`,
    entries: [
      {
        walletAccountId: custodyAccount.id,
        assetId: deposit.assetNetwork.assetId,
        amount: deposit.amount.negated(),
      },
      {
        walletAccountId: userAvailableAccount.id,
        assetId: deposit.assetNetwork.assetId,
        amount: deposit.amount,
      },
    ],
  });

  const creditedDeposit = await prisma.deposit.update({
    where: {
      id: deposit.id,
    },
    data: {
      status: DepositStatus.CREDITED,
      creditedAt: new Date(),
    },
  });

  return creditedDeposit;
};

const processDetectedDeposit = async ({
  networkCode,
  address,
  memo = null,
  txHash,
  eventIndex = 0,
  amount,
  confirmations = 0,
}) => {
  const deposit = await recordDetectedDeposit({
    networkCode,
    address,
    memo,
    txHash,
    eventIndex,
    amount,
    confirmations,
  });

  const updatedDeposit = await updateDepositConfirmations({
    networkCode,
    txHash,
    eventIndex,
    confirmations,
  });

  if (updatedDeposit.status === DepositStatus.CONFIRMED) {
    return creditConfirmedDeposit({
      depositId: updatedDeposit.id,
    });
  }

  return updatedDeposit;
};

export {
  creditConfirmedDeposit,
  recordDetectedDeposit,
  updateDepositConfirmations,
  processDetectedDeposit,
};

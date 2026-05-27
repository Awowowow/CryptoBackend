import {
  DepositStatus,
  LedgerTransactionType,
  WalletAccountType,
} from "@prisma/client";
import prisma from "../../config/prisma.js";
import AppError from "../../utils/AppError.js";
import { toDecimal } from "../../utils/decimals.js";
import {
  getOrcreateSystemWalletAccount,
  getOrCreateUserWalletAccounts,
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

  if (!Number.isInteger(confirmations) || confirmations < 0) {
    throw new AppError("Confirmations must be a non-negative integer", 400);
  }

  if (!Number.isInteger(eventIndex) || eventIndex < 0) {
    throw new AppError("Event index must be a non-negative integer", 400);
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

  return prisma.deposit.create({
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
};

const updateDepositConfirmations = async ({ depositId, confirmations }) => {
  if (!Number.isInteger(confirmations) || confirmations < 0) {
    throw new AppError("Confirmations must be a non-negative integer", 400);
  }

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

  if (
    deposit.status === DepositStatus.CREDITED ||
    deposit.status === DepositStatus.REJECTED
  ) {
    return deposit;
  }

  if (confirmations < deposit.confirmations) {
    return deposit;
  }

  const nextStatus = getDepositStatusFromConfirmations({
    confirmations,
    minConfirmations: deposit.assetNetwork.minConfirmations,
  });

  return prisma.deposit.update({
    where: {
      id: deposit.id,
    },
    data: {
      confirmations,
      status: nextStatus,
      confirmedAt:
        nextStatus === DepositStatus.CONFIRMED && deposit.confirmedAt === null
          ? new Date()
          : deposit.confirmedAt,
    },
  });
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

  const userAvailableWalletAccount = userWalletAccounts.find(
    (walletAccount) => walletAccount.type === WalletAccountType.AVAILABLE
  );

  if (!userAvailableWalletAccount) {
    throw new AppError("User available wallet account is missing", 500);
  }

  const systemCustodyWalletAccount = await getOrcreateSystemWalletAccount({
    assetId: deposit.assetNetwork.assetId,
    type: WalletAccountType.CUSTODY,
    label: "Main custody account",
  });

  await postLedgerTransaction({
    type: LedgerTransactionType.DEPOSIT,
    idempotencyKey: `deposit-credit:${deposit.id}`,
    referenceType: "DEPOSIT",
    referenceId: deposit.id,
    description: `Credit deposit ${deposit.id}`,
    entries: [
      {
        walletAccountId: systemCustodyWalletAccount.id,
        assetId: deposit.assetNetwork.assetId,
        amount: deposit.amount.negated(),
      },
      {
        walletAccountId: userAvailableWalletAccount.id,
        assetId: deposit.assetNetwork.assetId,
        amount: deposit.amount,
      },
    ],
  });

  return prisma.deposit.update({
    where: {
      id: deposit.id,
    },
    data: {
      status: DepositStatus.CREDITED,
      creditedAt: new Date(),
    },
  });
};

const processDetectedDeposit = async (payload) => {
  const deposit = await recordDetectedDeposit(payload);

  const updatedDeposit = await updateDepositConfirmations({
    depositId: deposit.id,
    confirmations: payload.confirmations ?? deposit.confirmations,
  });

  if (updatedDeposit.status !== DepositStatus.CONFIRMED) {
    return updatedDeposit;
  }

  return creditConfirmedDeposit({ depositId: updatedDeposit.id });
};

const listUserDeposits = async ({ userId }) => {
  if (!userId) {
    throw new AppError("User id is required", 400);
  }

  const deposits = await prisma.deposit.findMany({
    where: {
      userId,
    },
    orderBy: {
      detectedAt: "desc",
    },
    select: {
      id: true,
      txHash: true,
      eventIndex: true,
      amount: true,
      status: true,
      confirmations: true,
      detectedAt: true,
      confirmedAt: true,
      creditedAt: true,
      assetNetwork: {
        select: {
          minConfirmations: true,
          asset: {
            select: {
              id: true,
              symbol: true,
              name: true,
              decimals: true,
            },
          },
          network: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      },
      depositAddress: {
        select: {
          address: true,
          memo: true,
        },
      },
    },
  });

  return deposits.map((deposit) => {
    return {
      id: deposit.id,
      txHash: deposit.txHash,
      eventIndex: deposit.eventIndex,
      amount: deposit.amount.toString(),
      status: deposit.status,
      confirmations: deposit.confirmations,
      requiredConfirmations: deposit.assetNetwork.minConfirmations,
      detectedAt: deposit.detectedAt,
      confirmedAt: deposit.confirmedAt,
      creditedAt: deposit.creditedAt,
      asset: deposit.assetNetwork.asset,
      network: deposit.assetNetwork.network,
      address: deposit.depositAddress.address,
      memo: deposit.depositAddress.memo,
    };
  });
};

export {
  creditConfirmedDeposit,
  processDetectedDeposit,
  recordDetectedDeposit,
  updateDepositConfirmations,
  listUserDeposits
};

import { LedgerTransactionType, Prisma } from "@prisma/client";
import prisma from "../../config/prisma.js";
import AppError from "../../utils/AppError.js";
import { toDecimal } from "../../utils/decimals.js";


  const postLedgerTransaction = async ({
    type,
    idempotencyKey,
    referenceType = null,
    referenceId = null,
    description = null,
    entries,
    tx = null,
  }) => {
    const db = tx ?? prisma;
  // Reject malformed ledger requests before touching financial state.
  if (!Object.values(LedgerTransactionType).includes(type)) {
    throw new AppError("Invalid ledger transaction type", 400);
  }

  if (!idempotencyKey || typeof idempotencyKey !== "string") {
    throw new AppError("Idempotency key is required", 400);
  }

  if (!Array.isArray(entries) || entries.length < 2) {
    throw new AppError("A ledger transaction requires at least two entries", 400);
  }

  // Normalize caller input so all later checks use a trusted internal shape and precise decimals.
  const normalizedEntries = entries.map((entry, index) => {
    if (!entry.walletAccountId || !entry.assetId) {
      throw new AppError(
        `Entry ${index + 1} must include walletAccountId and assetId`,
        400
      );
    }

    const amount = toDecimal(entry.amount, `Entry ${index + 1} amount`);

    if (amount.isZero()) {
      throw new AppError(`Entry ${index + 1} amount cannot be zero`, 400);
    }

    return {
      walletAccountId: entry.walletAccountId,
      assetId: entry.assetId,
      amount,
    };
  });

  // Double-entry rule: each asset must balance independently so one asset cannot offset another.
  const totalsByAssetId = new Map();

  for (const entry of normalizedEntries) {
    const currentTotal =
      totalsByAssetId.get(entry.assetId) ?? new Prisma.Decimal(0);

    totalsByAssetId.set(
      entry.assetId,
      currentTotal.plus(entry.amount)
    );
  }

  for (const [assetId, total] of totalsByAssetId.entries()) {
    if (!total.isZero()) {
      throw new AppError(
        `Ledger entries for asset ${assetId} do not balance to zero`,
        400
      );
    }
  }

  // Retries of the same business event must not post the same money movement twice.
  const existingTransaction = await db.ledgerTransaction.findUnique({
    where: {
      idempotencyKey,
    },
    include: {
      entries: true,
    },
  });

  if (existingTransaction) {
    return existingTransaction;
  }

  // Load every referenced account once and verify entries point at valid account/asset pairs.
  const walletAccountIds = normalizedEntries.map(
    (entry) => entry.walletAccountId
  );

  const walletAccounts = await db.walletAccount.findMany({
    where: {
      id: {
        in: walletAccountIds,
      },
    },
    include: {
      balance: true,
    },
  });

  if (walletAccounts.length !== new Set(walletAccountIds).size) {
    throw new AppError("One or more wallet accounts were not found", 404);
  }

  const walletAccountsById = new Map(
    walletAccounts.map((walletAccount) => [walletAccount.id, walletAccount])
  );

  for (const entry of normalizedEntries) {
    const walletAccount = walletAccountsById.get(entry.walletAccountId);

    if (walletAccount.assetId !== entry.assetId) {
      throw new AppError(
        "Ledger entry asset does not match wallet account asset",
        400
      );
    }

    if (!walletAccount.balance) {
      throw new AppError("Wallet account balance record is missing", 500);
    }
  }

  // Simulate resulting balances before writing so users cannot spend funds they do not have.
  const nextBalancesByWalletAccountId = new Map();

  for (const entry of normalizedEntries) {
    const walletAccount = walletAccountsById.get(entry.walletAccountId);

    const currentBalance =
      nextBalancesByWalletAccountId.get(entry.walletAccountId) ??
      walletAccount.balance.balance;

    const nextBalance = currentBalance.plus(entry.amount);

    nextBalancesByWalletAccountId.set(
      entry.walletAccountId,
      nextBalance
    );
  }

  // User-owned balances may not go negative; system accounts can carry balancing positions.
  for (const walletAccount of walletAccounts) {
    const nextBalance = nextBalancesByWalletAccountId.get(walletAccount.id);

    if (
      walletAccount.ownerType === "USER" &&
      nextBalance &&
      nextBalance.isNegative()
    ) {
      throw new AppError("Insufficient wallet balance", 409);
    }
  }

  // Post immutable ledger history and update current balance snapshots atomically.
  const writeLedgerTransaction = async (client) => {
    const createdTransaction = await client.ledgerTransaction.create({
      data: {
        type,
        idempotencyKey,
        referenceType,
        referenceId,
        description,
      },
    });
  
    await client.ledgerEntry.createMany({
      data: normalizedEntries.map((entry) => ({
        ledgerTransactionId: createdTransaction.id,
        walletAccountId: entry.walletAccountId,
        assetId: entry.assetId,
        amount: entry.amount,
      })),
    });
  
    for (const [walletAccountId, nextBalance] of nextBalancesByWalletAccountId) {
      await client.walletBalance.update({
        where: {
          walletAccountId,
        },
        data: {
          balance: nextBalance,
        },
      });
    }
  
    return client.ledgerTransaction.findUnique({
      where: {
        id: createdTransaction.id,
      },
      include: {
        entries: true,
      },
    });
  };
  
  if (tx) {
    return writeLedgerTransaction(tx);
  }
  
  return prisma.$transaction(writeLedgerTransaction);
};
 
export { postLedgerTransaction }; 
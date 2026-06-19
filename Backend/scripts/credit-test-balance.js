import "dotenv/config";
import { LedgerTransactionType, WalletAccountType } from "@prisma/client";
import prisma from "../config/prisma.js";
import { postLedgerTransaction } from "../services/wallet-ledger-service/ledger.service.js";
import {
  getOrCreateUserWalletAccounts,
  getOrcreateSystemWalletAccount,
} from "../services/wallet-ledger-service/walletAccount.service.js";

const [, , email, assetSymbol, amount] = process.argv;

const creditTestBalance = async () => {
  if (!email || !assetSymbol || !amount) {
    throw new Error(
      "Usage: node Backend/scripts/credit-test-balance.js <email> <assetSymbol> <amount>"
    );
  }

  const user = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (!user) {
    throw new Error(`User not found: ${email}`);
  }

  const asset = await prisma.asset.findUnique({
    where: {
      symbol: assetSymbol.trim().toUpperCase(),
    },
  });

  if (!asset) {
    throw new Error(`Asset not found: ${assetSymbol}`);
  }

  const userWalletAccounts = await getOrCreateUserWalletAccounts({
    userId: user.id,
    assetId: asset.id,
  });

  const availableWalletAccount = userWalletAccounts.find(
    (walletAccount) => walletAccount.type === WalletAccountType.AVAILABLE
  );

  if (!availableWalletAccount) {
    throw new Error("User available wallet account not found");
  }

  const systemAdjustmentAccount = await getOrcreateSystemWalletAccount({
    assetId: asset.id,
    type: WalletAccountType.CUSTODY,
    systemAccountKey: "TEST_BALANCE_ADJUSTMENT",
    label: "Test balance adjustment account",
  });

  const ledgerTransaction = await postLedgerTransaction({
    type: LedgerTransactionType.ADMIN_ADJUSTMENT,
    idempotencyKey: `test-credit:${user.id}:${asset.symbol}:${amount}:${Date.now()}`,
    referenceType: "TEST_BALANCE_CREDIT",
    referenceId: user.id,
    description: `Credit ${amount} ${asset.symbol} test balance to ${email}`,
    entries: [
      {
        walletAccountId: availableWalletAccount.id,
        assetId: asset.id,
        amount,
      },
      {
        walletAccountId: systemAdjustmentAccount.id,
        assetId: asset.id,
        amount: `-${amount}`,
      },
    ],
  });

  console.log("Test balance credited:", {
    email,
    asset: asset.symbol,
    amount,
    ledgerTransactionId: ledgerTransaction.id,
  });
};

creditTestBalance()
  .catch((error) => {
    console.error("Failed to credit test balance:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
-- CreateEnum
CREATE TYPE "WalletOwnerType" AS ENUM ('USER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "WalletAccountType" AS ENUM ('AVAILABLE', 'LOCKED', 'CUSTODY', 'FEE_REVENUE');

-- CreateEnum
CREATE TYPE "LedgerTransactionType" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'FUNDS_LOCK', 'FUNDS_UNLOCK', 'TRADE_SETTLEMENT', 'FEE_COLLECTION', 'ADMIN_ADJUSTMENT');

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "symbol" VARCHAR(20) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "decimals" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "assetId" TEXT NOT NULL,
    "ownerType" "WalletOwnerType" NOT NULL,
    "type" "WalletAccountType" NOT NULL,
    "systemAccountKey" VARCHAR(120),
    "label" VARCHAR(120),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletBalance" (
    "id" TEXT NOT NULL,
    "walletAccountId" TEXT NOT NULL,
    "balance" DECIMAL(36,18) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerTransaction" (
    "id" TEXT NOT NULL,
    "type" "LedgerTransactionType" NOT NULL,
    "idempotencyKey" VARCHAR(180) NOT NULL,
    "referenceType" VARCHAR(80),
    "referenceId" VARCHAR(180),
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "ledgerTransactionId" TEXT NOT NULL,
    "walletAccountId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "amount" DECIMAL(36,18) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Asset_symbol_key" ON "Asset"("symbol");

-- CreateIndex
CREATE INDEX "WalletAccount_assetId_idx" ON "WalletAccount"("assetId");

-- CreateIndex
CREATE INDEX "WalletAccount_ownerType_type_idx" ON "WalletAccount"("ownerType", "type");

-- CreateIndex
CREATE UNIQUE INDEX "WalletAccount_userId_assetId_type_key" ON "WalletAccount"("userId", "assetId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "WalletAccount_systemAccountKey_assetId_type_key" ON "WalletAccount"("systemAccountKey", "assetId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "WalletBalance_walletAccountId_key" ON "WalletBalance"("walletAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerTransaction_idempotencyKey_key" ON "LedgerTransaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "LedgerTransaction_type_idx" ON "LedgerTransaction"("type");

-- CreateIndex
CREATE INDEX "LedgerTransaction_referenceType_referenceId_idx" ON "LedgerTransaction"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "LedgerTransaction_createdAt_idx" ON "LedgerTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "LedgerEntry_ledgerTransactionId_idx" ON "LedgerEntry"("ledgerTransactionId");

-- CreateIndex
CREATE INDEX "LedgerEntry_walletAccountId_idx" ON "LedgerEntry"("walletAccountId");

-- CreateIndex
CREATE INDEX "LedgerEntry_assetId_idx" ON "LedgerEntry"("assetId");

-- CreateIndex
CREATE INDEX "LedgerEntry_createdAt_idx" ON "LedgerEntry"("createdAt");

-- AddForeignKey
ALTER TABLE "WalletAccount" ADD CONSTRAINT "WalletAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletAccount" ADD CONSTRAINT "WalletAccount_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletBalance" ADD CONSTRAINT "WalletBalance_walletAccountId_fkey" FOREIGN KEY ("walletAccountId") REFERENCES "WalletAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_ledgerTransactionId_fkey" FOREIGN KEY ("ledgerTransactionId") REFERENCES "LedgerTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_walletAccountId_fkey" FOREIGN KEY ("walletAccountId") REFERENCES "WalletAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

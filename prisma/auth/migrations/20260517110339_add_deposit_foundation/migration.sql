-- CreateEnum
CREATE TYPE "DepositStatus" AS ENUM ('DETECTED', 'CONFIRMING', 'CONFIRMED', 'CREDITED', 'REJECTED');

-- CreateTable
CREATE TABLE "BlockchainNetwork" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlockchainNetwork_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetNetwork" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "networkId" TEXT NOT NULL,
    "depositEnabled" BOOLEAN NOT NULL DEFAULT true,
    "withdrawalEnabled" BOOLEAN NOT NULL DEFAULT true,
    "minConfirmations" INTEGER NOT NULL DEFAULT 1,
    "contractAddress" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetNetwork_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepositAddress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assetNetworkId" TEXT NOT NULL,
    "networkId" TEXT NOT NULL,
    "address" VARCHAR(255) NOT NULL,
    "memo" VARCHAR(255),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepositAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deposit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assetNetworkId" TEXT NOT NULL,
    "networkId" TEXT NOT NULL,
    "depositAddressId" TEXT NOT NULL,
    "txHash" VARCHAR(255) NOT NULL,
    "outputIndex" INTEGER,
    "amount" DECIMAL(36,18) NOT NULL,
    "status" "DepositStatus" NOT NULL DEFAULT 'DETECTED',
    "confirmations" INTEGER NOT NULL DEFAULT 0,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "creditedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deposit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BlockchainNetwork_code_key" ON "BlockchainNetwork"("code");

-- CreateIndex
CREATE INDEX "AssetNetwork_networkId_idx" ON "AssetNetwork"("networkId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetNetwork_assetId_networkId_key" ON "AssetNetwork"("assetId", "networkId");

-- CreateIndex
CREATE INDEX "DepositAddress_userId_idx" ON "DepositAddress"("userId");

-- CreateIndex
CREATE INDEX "DepositAddress_assetNetworkId_idx" ON "DepositAddress"("assetNetworkId");

-- CreateIndex
CREATE INDEX "DepositAddress_networkId_idx" ON "DepositAddress"("networkId");

-- CreateIndex
CREATE UNIQUE INDEX "DepositAddress_networkId_address_memo_key" ON "DepositAddress"("networkId", "address", "memo");

-- CreateIndex
CREATE INDEX "Deposit_userId_idx" ON "Deposit"("userId");

-- CreateIndex
CREATE INDEX "Deposit_assetNetworkId_idx" ON "Deposit"("assetNetworkId");

-- CreateIndex
CREATE INDEX "Deposit_networkId_idx" ON "Deposit"("networkId");

-- CreateIndex
CREATE INDEX "Deposit_depositAddressId_idx" ON "Deposit"("depositAddressId");

-- CreateIndex
CREATE INDEX "Deposit_status_idx" ON "Deposit"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Deposit_networkId_txHash_outputIndex_key" ON "Deposit"("networkId", "txHash", "outputIndex");

-- AddForeignKey
ALTER TABLE "AssetNetwork" ADD CONSTRAINT "AssetNetwork_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetNetwork" ADD CONSTRAINT "AssetNetwork_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "BlockchainNetwork"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepositAddress" ADD CONSTRAINT "DepositAddress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepositAddress" ADD CONSTRAINT "DepositAddress_assetNetworkId_fkey" FOREIGN KEY ("assetNetworkId") REFERENCES "AssetNetwork"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepositAddress" ADD CONSTRAINT "DepositAddress_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "BlockchainNetwork"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_assetNetworkId_fkey" FOREIGN KEY ("assetNetworkId") REFERENCES "AssetNetwork"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "BlockchainNetwork"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_depositAddressId_fkey" FOREIGN KEY ("depositAddressId") REFERENCES "DepositAddress"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

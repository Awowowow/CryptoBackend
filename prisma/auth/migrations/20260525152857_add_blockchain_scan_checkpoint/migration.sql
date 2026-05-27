-- CreateTable
CREATE TABLE "BlockchainScanCheckpoint" (
    "id" TEXT NOT NULL,
    "scannerKey" VARCHAR(120) NOT NULL,
    "networkId" TEXT NOT NULL,
    "lastScannedBlock" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlockchainScanCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BlockchainScanCheckpoint_scannerKey_key" ON "BlockchainScanCheckpoint"("scannerKey");

-- CreateIndex
CREATE INDEX "BlockchainScanCheckpoint_networkId_idx" ON "BlockchainScanCheckpoint"("networkId");

-- AddForeignKey
ALTER TABLE "BlockchainScanCheckpoint" ADD CONSTRAINT "BlockchainScanCheckpoint_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "BlockchainNetwork"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

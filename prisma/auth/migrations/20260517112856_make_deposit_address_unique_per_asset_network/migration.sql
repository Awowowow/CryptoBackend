/*
  Warnings:

  - A unique constraint covering the columns `[userId,assetNetworkId]` on the table `DepositAddress` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "DepositAddress_userId_assetNetworkId_key" ON "DepositAddress"("userId", "assetNetworkId");

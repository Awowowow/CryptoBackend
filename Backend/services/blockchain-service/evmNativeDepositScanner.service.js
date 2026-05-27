import { formatEther } from "ethers";
import prisma from "../../config/prisma.js";
import { getEvmProvider } from "./evmProvider.service.js";
import { processDetectedDeposit } from "../wallet-ledger-service/deposit.service.js";

const scanNativeEthDeposits = async ({ fromBlock, toBlock }) => {
  const provider = getEvmProvider();

  const activeEthDepositAddresses = await prisma.depositAddress.findMany({
    where: {
      isActive: true,
      assetNetwork: {
        asset: {
          symbol: "ETH",
        },
        network: {
          code: "ETH_HOODI",
        },
        depositEnabled: true,
      },
    },
    select: {
      address: true,
    },
  });

  const depositAddressSet = new Set(
    activeEthDepositAddresses.map((depositAddress) =>
      depositAddress.address.toLowerCase()
    )
  );

  if (depositAddressSet.size === 0) {
    return {
      scannedBlocks: 0,
      detectedDeposits: 0,
    };
  }

  let detectedDeposits = 0;

  for (let blockNumber = fromBlock; blockNumber <= toBlock; blockNumber += 1) {
    const block = await provider.getBlock(blockNumber, true);

    if (!block) {
      continue;
    }

    for (const transaction of block.prefetchedTransactions ?? []) {
      if (!transaction.to) {
        continue;
      }

      const receiverAddress = transaction.to.toLowerCase();

      if (!depositAddressSet.has(receiverAddress)) {
        continue;
      }

      if (transaction.value <= 0n) {
        continue;
      }

      const confirmations = toBlock - blockNumber + 1;

      await processDetectedDeposit({
        networkCode: "ETH_HOODI",
        address: receiverAddress,
        txHash: transaction.hash,
        eventIndex: 0,
        amount: formatEther(transaction.value),
        confirmations,
      });

      detectedDeposits += 1;
    }
  }

  return {
    scannedBlocks: toBlock - fromBlock + 1,
    detectedDeposits,
  };
};

export { scanNativeEthDeposits }; 
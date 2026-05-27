import prisma from "../../config/prisma.js";
import AppError from "../../utils/AppError.js";
import { getEvmProvider } from "./evmProvider.service.js";
import { scanNativeEthDeposits } from "./evmNativeDepositScanner.service.js";

const HOODI_NETWORK_CODE = "ETH_HOODI";
const NATIVE_ETH_HOODI_SCANNER_KEY = "NATIVE_ETH:ETH_HOODI";

const SAFE_BLOCK_DELAY = 2;
const MAX_BLOCKS_PER_SCAN = 50;

const getHoodiScanStartBlock = () => {
  const startBlock = Number(process.env.HOODI_SCAN_START_BLOCK);

  if (!Number.isInteger(startBlock) || startBlock < 0) {
    throw new AppError(
      "HOODI_SCAN_START_BLOCK is not configured correctly",
      500
    );
  }

  return startBlock;
};

const getOrCreateNativeEthHoodiCheckpoint = async ({ networkId }) => {
  const startBlock = getHoodiScanStartBlock();

  return prisma.blockchainScanCheckpoint.upsert({
    where: {
      scannerKey: NATIVE_ETH_HOODI_SCANNER_KEY,
    },
    update: {},
    create: {
      scannerKey: NATIVE_ETH_HOODI_SCANNER_KEY,
      networkId,
      lastScannedBlock: BigInt(startBlock - 1),
    },
  });
};

const runNativeEthHoodiScanCycle = async () => {
  const network = await prisma.blockchainNetwork.findUnique({
    where: {
      code: HOODI_NETWORK_CODE,
    },
  });

  if (!network) {
    throw new AppError("Ethereum Hoodi network is not configured", 500);
  }

  const provider = getEvmProvider();
  const latestBlock = await provider.getBlockNumber();
  const safeBlock = latestBlock - SAFE_BLOCK_DELAY;

  const checkpoint = await getOrCreateNativeEthHoodiCheckpoint({
    networkId: network.id,
  });

  const fromBlock = Number(checkpoint.lastScannedBlock) + 1;

  if (fromBlock > safeBlock) {
    return {
      scannerKey: NATIVE_ETH_HOODI_SCANNER_KEY,
      latestBlock,
      safeBlock,
      scannedBlocks: 0,
      detectedDeposits: 0,
    };
  }

  const toBlock = Math.min(
    fromBlock + MAX_BLOCKS_PER_SCAN - 1,
    safeBlock
  );

  const result = await scanNativeEthDeposits({
    fromBlock,
    toBlock,
  });

  await prisma.blockchainScanCheckpoint.update({
    where: {
      scannerKey: NATIVE_ETH_HOODI_SCANNER_KEY,
    },
    data: {
      lastScannedBlock: BigInt(toBlock),
    },
  });

  return {
    scannerKey: NATIVE_ETH_HOODI_SCANNER_KEY,
    latestBlock,
    safeBlock,
    fromBlock,
    toBlock,
    ...result,
  };
};

export { runNativeEthHoodiScanCycle };
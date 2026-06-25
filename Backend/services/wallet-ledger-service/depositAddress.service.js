import prisma from "../../config/prisma.js";
import AppError from "../../utils/AppError.js";
import { createCustodyReceiveAddress } from "../custody-service/custodyProvider.service.js";

const formatDepositAddress = (depositAddress) => {
  return {
    id: depositAddress.id,
    address: depositAddress.address,
    memo: depositAddress.memo,
    asset: {
      id: depositAddress.assetNetwork.asset.id,
      symbol: depositAddress.assetNetwork.asset.symbol,
      name: depositAddress.assetNetwork.asset.name,
      decimals: depositAddress.assetNetwork.asset.decimals,
    },
    network: {
      id: depositAddress.assetNetwork.network.id,
      code: depositAddress.assetNetwork.network.code,
      name: depositAddress.assetNetwork.network.name,
    },
    createdAt: depositAddress.createdAt,
  };
};

const getOrCreateDepositAddress = async ({
  userId,
  assetSymbol,
  networkCode,
}) => {
  if (!assetSymbol || typeof assetSymbol !== "string") {
    throw new AppError("Asset symbol is required", 400);
  }

  const normalizedAssetSymbol = assetSymbol.trim().toUpperCase();

  if (!normalizedAssetSymbol) {
    throw new AppError("Asset symbol is required", 400);
  }

  if (!networkCode || typeof networkCode !== "string") {
    throw new AppError("Network code is required", 400);
  }
  
  const normalizedNetworkCode = networkCode.trim().toUpperCase();
  
  if (!normalizedNetworkCode) {
    throw new AppError("Network code is required", 400);
  }

  const assetNetwork = await prisma.assetNetwork.findFirst({
    where: {
      asset: {
        symbol: normalizedAssetSymbol,
        isActive: true,
      },
      network: {
        code: normalizedNetworkCode,
        isActive: true,
      },
      depositEnabled: true,
    },
    include: {
      asset: true,
      network: true,
    },
  });

  if (!assetNetwork) {
    throw new AppError("Deposits are not supported for this asset", 404);
  }

  const existingDepositAddress = await prisma.depositAddress.findUnique({
    where: {
      userId_assetNetworkId: {
        userId,
        assetNetworkId: assetNetwork.id,
      },
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

  if (existingDepositAddress) {
    return formatDepositAddress(existingDepositAddress);
  }

  const custodyReceiveAddress = await createCustodyReceiveAddress({
    networkCode: assetNetwork.network.code,
    label: `CryptoEx ${assetNetwork.asset.symbol} deposit for user ${userId}`,
  });

  const depositAddress = await prisma.depositAddress.create({
    data: {
      userId,
      assetNetworkId: assetNetwork.id,
      networkId: assetNetwork.network.id,
      address: custodyReceiveAddress.address,
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

  return formatDepositAddress(depositAddress);
};

export { getOrCreateDepositAddress };

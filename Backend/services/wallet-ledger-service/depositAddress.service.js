import crypto from "crypto";
import prisma from "../../config/prisma.js";
import AppError from "../../utils/appError.js";

const generateDevelopmentDepositAddress = ({ assetSymbol, userId }) => {
  const randomSuffix = crypto.randomUUID();
  return `dev_${assetSymbol.toLowerCase()}_${userId}_${randomSuffix}`;
};

const getOrCreateDepositAddress = async ({ userId, assetSymbol }) => {
    const normalizedAssetSymbol = assetSymbol.trim().toUpperCase();
  
    const assetNetwork = await prisma.assetNetwork.findFirst({
      where: {
        asset: {
          symbol: normalizedAssetSymbol,
          isActive: true,
        },
        network: {
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
  
    const address = generateDevelopmentDepositAddress({
      assetSymbol: assetNetwork.asset.symbol,
      userId,
    });
  
    const depositAddress = await prisma.depositAddress.upsert({
      where: {
        userId_assetNetworkId: {
          userId,
          assetNetworkId: assetNetwork.id,
        },
      },
      update: {},
      create: {
        userId,
        assetNetworkId: assetNetwork.id,
        networkId: assetNetwork.network.id,
        address,
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
  
    return depositAddress;
  };

export {
    getOrCreateDepositAddress
}
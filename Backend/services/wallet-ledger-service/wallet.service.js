import prisma from "../../config/prisma.js"
import { toDecimal } from "../../utils/decimals.js";
import { getOrCreateUserWalletAccounts } from "./walletAccount.service.js";
import { WalletAccountType } from "@prisma/client";

const getUserWalletBalance = async (userId) =>{
    const activeUser = await prisma.asset.findMany({
        where:{
            isActive: true,
        },
        orderBy:{
            symbol: "asc",
        },
    });

    for(const asset of activeUser){
        await getOrCreateUserWalletAccounts({
            userId,
            assetId: asset.id,
        })
    }

    const walletAccounts = await prisma.walletAccount.findMany({
        where: {
          userId,
          ownerType: "USER",
          asset: {
            isActive: true,
          },
        },
        include: {
          asset: true,
          balance: true,
        },
      });
    
      const balancesByAssetId = new Map();
    
      for (const walletAccount of walletAccounts) {
        if (!walletAccount.balance) {
          continue;
        }
    
        const existingAssetBalance = balancesByAssetId.get(walletAccount.assetId) ?? {
          asset: {
            id: walletAccount.asset.id,
            symbol: walletAccount.asset.symbol,
            name: walletAccount.asset.name,
            decimals: walletAccount.asset.decimals,
          },
          available: "0",
          locked: "0",
        };
    
        if (walletAccount.type === WalletAccountType.AVAILABLE) {
          existingAssetBalance.available = walletAccount.balance.balance.toString();
        }
    
        if (walletAccount.type === WalletAccountType.LOCKED) {
          existingAssetBalance.locked = walletAccount.balance.balance.toString();
        }
    
        balancesByAssetId.set(walletAccount.assetId, existingAssetBalance);
      }
      return Array.from(balancesByAssetId.values()).map((assetBalance) => {
        const total = toDecimal(assetBalance.available)
          .plus(toDecimal(assetBalance.locked))
          .toString();
    
        return {
          ...assetBalance,
          total,
        };
      });
}

export {getUserWalletBalance}
import {
    WalletAccountType,
    WalletOwnerType,
  } from "@prisma/client";
  import prisma from "../../config/prisma.js";
  
const getOrCreateUserWalletAccounts = async ({ userId, assetId }) => {
    const accountTypes = [
      WalletAccountType.AVAILABLE,
      WalletAccountType.LOCKED,
    ];
  
    const accounts = [];
  
    for (const type of accountTypes) {
      const account = await prisma.walletAccount.upsert({
        where: {
          userId_assetId_type: {
            userId,
            assetId,
            type,
          },
        },
        update: {},
        create: {
          userId,
          assetId,
          ownerType: WalletOwnerType.USER,
          type,
          balance: {
            create: {
              balance: 0,
            },
          },
        },
        include: {
          balance: true,
        },
      });
  
      accounts.push(account);
    }
  
    return accounts;
};
  
const getOrcreateSystemWalletAccount = async ({ assetId, type, systemAccountKey = "MAIN", label = null,}) => {
    const account = await prisma.walletAccount.upsert({
        where: {
            systemAccountKey_assetId_type:{
                systemAccountKey,
                assetId,
                type,
            },
        },
        update: {},
        create:{
            assetId,
            ownerType: WalletOwnerType.SYSTEM,
            type,
            systemAccountKey,
            label,
            balance:{
                create:{
                    balance: 0
                },
            },
        },
        include:{
            balance: true,
        },
    });
    return account
}   
  export { getOrCreateUserWalletAccounts,getOrcreateSystemWalletAccount };

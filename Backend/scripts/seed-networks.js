import prisma from "../config/prisma.js";

const networks = [
  {
    code: "BTC",
    name: "Bitcoin",
  },
  {
    code: "BTC_TESTNET",
    name: "Bitcoin Testnet",
  },
  {
    code: "ETH_HOODI",
    name: "Ethereum Hoodi",
  },
];

const assetNetworks = [
  {
    assetSymbol: "BTC",
    networkCode: "BTC",
    minConfirmations: 3,
  },
  {
    assetSymbol: "BTC",
    networkCode: "BTC_TESTNET",
    minConfirmations: 1,
  },
  {
    assetSymbol: "ETH",
    networkCode: "ETH_HOODI",
    minConfirmations: 12,
  },
  {
    assetSymbol: "USDT",
    networkCode: "ETH_HOODI",
    minConfirmations: 12,
  },
];


const seedNetworks = async () => {
    for (const network of networks){
      await prisma.blockchainNetwork.upsert({
            where:{
                code: network.code,
            },
            update:{
                name: network.name,
                isActive: true,
            },
            create:{
                code: network.code,
                name: network.name,
            }
        });
    }
}

const seedAssetNetworks = async () => {
    for (const item of assetNetworks) {
      const asset = await prisma.asset.findUnique({
        where: {
          symbol: item.assetSymbol,
        },
      });
  
      if (!asset) {
        throw new Error(`Asset ${item.assetSymbol} was not found`);
      }
  
      const network = await prisma.blockchainNetwork.findUnique({
        where: {
          code: item.networkCode,
        },
      });
  
      if (!network) {
        throw new Error(`Network ${item.networkCode} was not found`);
      }
  
      await prisma.assetNetwork.upsert({
        where: {
          assetId_networkId: {
            assetId: asset.id,
            networkId: network.id,
          },
        },
        update: {
          depositEnabled: true,
          withdrawalEnabled: true,
          minConfirmations: item.minConfirmations,
        },
        create: {
          assetId: asset.id,
          networkId: network.id,
          depositEnabled: true,
          withdrawalEnabled: true,
          minConfirmations: item.minConfirmations,
        },
      });
    }
};

const main = async () => {
    await seedNetworks();
    await seedAssetNetworks();
  
    console.log("Networks and asset networks seeded successfully");
  };
  
  main()
    .catch((error) => {
      console.error("Failed to seed networks:", error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
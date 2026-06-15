import prisma from "../config/prisma.js";

const assets = [
  {
    symbol: "BTC",
    name: "Bitcoin",
    decimals: 8,
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    decimals: 18,
  },
  {
    symbol: "USDT",
    name: "Tether",
    decimals: 6,
  },
];

const seedAssets = async () => {
  for (const asset of assets) {
    await prisma.asset.upsert({
      where: {
        symbol: asset.symbol,
      },
      update: {
        name: asset.name,
        decimals: asset.decimals,
      },
      create: asset,
    });
  }
};

seedAssets()
  .then(async () => {
    console.log("Assets seeded successfully");
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("Failed to seed assets", error);
    await prisma.$disconnect();
    process.exit(1);
  });